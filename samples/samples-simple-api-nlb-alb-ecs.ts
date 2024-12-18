import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { QSNetworkStack } from "../lib/qs-network-stack";
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery'; // Import Cloud Map
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';  // Import ECR repository
import { AlbListenerTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";

export class EcsCdkSimpleApiNlbAlbEcsDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC and overall network
    const networkStack = new QSNetworkStack(scope, "ecsNetworkStackName1", {
      env: {
        region: "us-east-1",
      },
      vpcCidr: "10.101.0.0/16",
      azs: ["us-east-1a", "us-east-1b"],
    });

    const vpc: ec2.IVpc = networkStack.network.vpc;
    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, "Test-ECS-Cluster", {
      vpc: vpc,
    });

    // Create a Cloud Map namespace for service discovery
    const cloudmapNamespace = new servicediscovery.PrivateDnsNamespace(
      this,
      "Namespace",
      {
        name: "ecsnamespace",
        vpc: vpc,
      }
    );

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
      "privateEcrRepo",
      "quickysoft/sample-spring-boot-app"
    );

    // Task Execution Role with AmazonECSTaskExecutionRolePolicy attached
    const taskExecutionRole = new iam.Role(this, "TaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    // Attach AmazonECSTaskExecutionRolePolicy for ECR image pull permissions
    taskExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonECS_FullAccess")
    );

    // Create a Fargate task definition for Backend
    const backendTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "backendTaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 256,
        executionRole: taskExecutionRole, // Set execution role for ECR pull
      }
    );

    const backendContainer = backendTaskDefinition.addContainer("backend", {
      image: ecs.ContainerImage.fromEcrRepository(privateEcrRepo, "latest"), // Specify tag if needed
      //image: externalEcrImage,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "backend" }),
      environment: {
        APP_CONTEXT_PATH: "/backend",
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
        name: "backendapi",
        cloudMapNamespace: cloudmapNamespace,
      },
    });

    // Create a Fargate task definition
    const frontend1TaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "frontend1TaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 256,
        executionRole: taskExecutionRole, // Set execution role for ECR pull
      }
    );

    const frontend1AppContainer = frontend1TaskDefinition.addContainer(
      "frontend1Service",
      {
        image: ecs.ContainerImage.fromEcrRepository(privateEcrRepo, "latest"), // Specify tag if needed
        //image: externalEcrImage,
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: "frontend1" }),
        environment: {
          APP_CONTEXT_PATH: "/frontend1",
          DB_URL: "db@serviceIP:onPort",
          secretsmanagerkey: "secretsmanagerkey_value",
          EXTERNAL_GET_URL1:
            "http://backendapi.ecsnamespace/backend/api/greet",
          EXTERNAL_GET_URL2:
            "http://backendapi.ecsnamespace/backend/api/external-api",
        },
      }
    );

    frontend1AppContainer.addPortMappings({
      containerPort: 80,
    });

    // Create a Fargate service
    const frontend1AppService = new ecs.FargateService(this, "frontend1Service", {
      cluster,
      taskDefinition: frontend1TaskDefinition,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
      cloudMapOptions: {
        name: "frontend1api",
        cloudMapNamespace: cloudmapNamespace,
      },
    });

    // Create a Fargate task definition
    const frontend2TaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "frontend2TaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 256,
        executionRole: taskExecutionRole, // Set execution role for ECR pull
      }
    );

    const frontend2AppContainer = frontend2TaskDefinition.addContainer(
      "frontend2Service",
      {
        image: ecs.ContainerImage.fromEcrRepository(privateEcrRepo, "latest"), // Specify tag if needed
        //image: externalEcrImage,
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: "frontend2" }),
        environment: {
          APP_CONTEXT_PATH: "/frontend2",
          DB_URL: "db@serviceIP:onPort",
          secretsmanagerkey: "secretsmanagerkey_value",
          EXTERNAL_GET_URL1:
            "http://backendapi.ecsnamespace/backend/api/greet",
          EXTERNAL_GET_URL2:
            "http://backendapi.ecsnamespace/backend/api/external-api",
        },
      }
    );

    frontend2AppContainer.addPortMappings({
      containerPort: 80,
    });

    // Create a Fargate service
    const frontend2AppService = new ecs.FargateService(this, "frontend2Service", {
      cluster,
      taskDefinition: frontend2TaskDefinition,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
      cloudMapOptions: {
        name: "frontend2api",
        cloudMapNamespace: cloudmapNamespace,
      },
    });

    // Create an Application Load Balancer (ALB)
    const appAlb = new elbv2.ApplicationLoadBalancer(
      this,
      this.stackName + "Alb",
      {
        vpc: vpc,
        internetFacing: false,
        securityGroup: ecsSecurityGroup,
      }
    );
    const applicationListener = appAlb.addListener(
      this.stackName + "Listener",
      {
        port: 80,
        open: true,
      }
    );
    const appDefaultTragetGroup = applicationListener.addTargets(
      "backend ListenerTarget",
      {
        port: 80,
        targets: [backendService],
        healthCheck: {
          interval: cdk.Duration.seconds(15),
          path: "/" + "backend" + "/actuator/health",
          timeout: cdk.Duration.seconds(5),
        },
      }
    );
    const appFrontend1TragetGroup = applicationListener.addTargets(
      "frontend1ListenerTarget",
      {
        port: 80,
        targets: [frontend1AppService],
        conditions: [
          elbv2.ListenerCondition.pathPatterns(["/" + "frontend1" + "*"]),
        ],
        priority: 1,
        healthCheck: {
          interval: cdk.Duration.seconds(15),
          path: "/" + "frontend1" + "/actuator/health",
          timeout: cdk.Duration.seconds(5),
        },
      }
    );
    const appFrontend2TragetGroup = applicationListener.addTargets(
      "frontend2ListenerTarget",
      {
        port: 80,
        targets: [frontend2AppService],
        conditions: [
          elbv2.ListenerCondition.pathPatterns(["/" + "frontend2" + "*"]),
        ],
        priority: 2,
        healthCheck: {
          interval: cdk.Duration.seconds(15),
          path: "/" + "frontend2" + "/actuator/health",
          timeout: cdk.Duration.seconds(5),
        },
      }
    );

    const nlb = new elbv2.NetworkLoadBalancer(this, "LB", {
      vpc,
      internetFacing: true,
    });

    const nlbListener = nlb.addListener("PublicListener", {
      port: 80,
    });

    //add the ALB listener target that can be used with teh NLB.
    const albTarget = new AlbListenerTarget(applicationListener);
    nlbListener.addTargets(this.stackName + "ALBTg", {
      port: 80,
      targets: [albTarget],
      protocol: elbv2.Protocol.TCP,
      healthCheck: {
        interval: cdk.Duration.seconds(15),
        path: "/" + 'backend' + "/actuator/health",
        timeout: cdk.Duration.seconds(5),
      },
    });

    // Create a VPC Link for API Gateway
    const vpcLink = new apigateway.VpcLink(this, "VpcLink", {
      targets: [nlb],
    });

    // Create an API Gateway
    const api = new apigateway.RestApi(this, "ApiGateway", {
      restApiName: "FrontEndSpringBootAppServiceApi",
      description:
        "API Gateway to access SpringBootApp service running on ECS Fargate",
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
          "integration.request.path.proxy": "method.request.path.proxy", // Pass the path to NLB
        },
      },
    });

    api.root.addResource("{proxy+}").addMethod("ANY", rootIntegration, {
      requestParameters: {
        "method.request.path.proxy": true, // Enable path proxying
      },
    });

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: nlb.loadBalancerDnsName,
    });
  }
}
