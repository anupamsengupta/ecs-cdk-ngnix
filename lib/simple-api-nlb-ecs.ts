import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { QSNetworkStack } from "./qs-network-stack";
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery'; // Import Cloud Map
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';  // Import ECR repository

export class EcsCdkSimpleApiNlbEcsDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC and overall network
    const networkStack = new QSNetworkStack(
      scope,
      "ecsNetworkStackName1",
      {
        env: {
          region: "us-east-1",
        },
        vpcCidr: "10.101.0.0/16",
        azs: ["us-east-1a", "us-east-1b"],
      }
    );

    const vpc: ec2.IVpc = networkStack.network.vpc;
    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, "Test-ECS-Cluster", {
      vpc: vpc,
    });

    // Create a Cloud Map namespace for service discovery
    const cloudmapNamespace = new servicediscovery.PrivateDnsNamespace(this, 'Namespace', {
      name: 'ecsnamespace',
      vpc: vpc
    });

    // Create a security group for the ECS service
    const ecsSecurityGroup = new ec2.SecurityGroup(this, "EcsSecurityGroup", {
      vpc,
      description: "Allow traffic from NLB",
      allowAllOutbound: true,
    });

    // Allow inbound traffic from the NLB on port 80
    ecsSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(80),
      "Allow traffic from NLB"
    );

    const privateEcrRepo = ecr.Repository.fromRepositoryName(
      this, 
      'privateEcrRepo', 
      'quickysoft/sample-spring-boot-app');

    // Task Execution Role with AmazonECSTaskExecutionRolePolicy attached
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Attach AmazonECSTaskExecutionRolePolicy for ECR image pull permissions
    taskExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECS_FullAccess')
    );

    // Create a Fargate task definition for Backend
    const backendTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "backendTaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 256,
        executionRole: taskExecutionRole // Set execution role for ECR pull
      }
    );

    const backendContainer = backendTaskDefinition.addContainer("backend", {
      image: ecs.ContainerImage.fromEcrRepository(privateEcrRepo, 'latest'), // Specify tag if needed
      //image: externalEcrImage,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "backend" }),
      environment: {
        DB_URL: "db@serviceIP:onPort",
        secretsmanagerkey: "secretsmanagerkey_value",
      },
    });

    backendContainer.addPortMappings({
      containerPort: 80,
    });

    // Create a Fargate service for Backend
    const backendService = new ecs.FargateService(this, "BackendService", {
      cluster,
      taskDefinition: backendTaskDefinition,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
      cloudMapOptions: {
        name: 'backendapi',
        cloudMapNamespace: cloudmapNamespace
      },
    });


      // Create a Fargate task definition
    const frontendTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "frontendTaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 256,
        executionRole: taskExecutionRole // Set execution role for ECR pull
      },
    );

    const frontendAppContainer = frontendTaskDefinition.addContainer("FrontendService", {
      image: ecs.ContainerImage.fromEcrRepository(privateEcrRepo, 'latest'), // Specify tag if needed
      //image: externalEcrImage,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'frontend' }),
      environment: {
        APP_CONTEXT_PATH: '/frontend',
        EXTERNAL_GET_URL1: `http://backendapi.ecsnamespace/api/get-external-data`,
        EXTERNAL_GET_URL2: `http://backendapi.ecsnamespace/api/get-external-data`,
      },
    });

    frontendAppContainer.addPortMappings({
      containerPort: 80,
    });

    // Create a Fargate service
    const frontendAppService = new ecs.FargateService(this, "FrontendService", {
      cluster,
      taskDefinition: frontendTaskDefinition,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
      cloudMapOptions: {
        name: 'frontendapi',
        cloudMapNamespace: cloudmapNamespace
      },
    });


    const nlb = new elbv2.NetworkLoadBalancer(this, "LB", {
      vpc,
      internetFacing: true,
    });

    const listener = nlb.addListener("PublicListener", {
      port: 80,
    });

    listener.addTargets("EcsTg", {
      port: 80,
      targets: [frontendAppService],
    });

    // Create a VPC Link for API Gateway
    const vpcLink = new apigateway.VpcLink(this, "VpcLink", {
      targets: [nlb],
    });

    // Create an API Gateway
    const api = new apigateway.RestApi(this, "ApiGateway", {
      restApiName: "FrontEndSpringBootAppServiceApi",
      description: "API Gateway to access SpringBootApp service running on ECS Fargate",
    });

    // Create GET methods with VPC Link integration for each resource
    const integration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: "ANY",
      uri: `http://${nlb.loadBalancerDnsName}/{proxy}`,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink,
      },
    });

    // Add a root resource level health check
    const rootIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: "ANY",
      uri: `http://${nlb.loadBalancerDnsName}/{proxy}`,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink,
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
        requestParameters: {
          'integration.request.path.proxy': 'method.request.path.proxy'  // Pass the path to NLB
        }
      },
    });

    api.root.addResource('{proxy+}').addMethod('ANY', rootIntegration, {
      requestParameters: {
        'method.request.path.proxy': true  // Enable path proxying
      }
    });

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: nlb.loadBalancerDnsName,
    });
  }
}
