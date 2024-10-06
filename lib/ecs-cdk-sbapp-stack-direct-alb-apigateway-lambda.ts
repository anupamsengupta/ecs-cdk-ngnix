import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { QSNetworkStack } from "./qs-network-stack";
import * as ecr from 'aws-cdk-lib/aws-ecr';  // Import ECR repository
import * as iam from 'aws-cdk-lib/aws-iam';

export class EcsCdkSBAppDirectStackSimple extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC and overall network
    const networkClusterStack = new QSNetworkStack(
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

    const vpc: ec2.IVpc = networkClusterStack.network.vpc;
    // Create an ECS cluster
    const cluster = new ecs.Cluster(this, "Test-ECS-Cluster", {
      vpc: vpc,
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

    // Create a Fargate task definition
    const sbapp1TaskDefinition = new ecs.FargateTaskDefinition(this, "sbapp1TaskDef", {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole, // Set execution role for ECR pull
    });

    const sbapp1Container = sbapp1TaskDefinition.addContainer("sbapp1", 
      {
        image: ecs.ContainerImage.fromEcrRepository(privateEcrRepo, "latest"), // Specify tag if needed
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: "sbappContainer" }),
        environment: {
          DB_URL: "db@serviceIP:onPort",
          secretsmanagerkey: "secretsmanagerkey_value",
          APP_CONTEXT_PATH: "/sbappx1",
        },
        portMappings: [{ containerPort: 80 }],
      }
    );

    // Create a Fargate service
    const sbapp1Service = new ecs.FargateService(this, "sbapp1Service", {
      cluster,
      taskDefinition: sbapp1TaskDefinition,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
    });

    // Create an Application Load Balancer (ALB)
    const lb = new elbv2.ApplicationLoadBalancer(this, "LB", {
      vpc,
      internetFacing: false,
    });

    const listener = lb.addListener("sbapp1Listener", {
      port: 80,
      open: true,
    });

    // Attach the ECS service to the ALB
    listener.addTargets("ECS", {
      port: 80,
      targets: [sbapp1Service],
      healthCheck: {
        interval: cdk.Duration.seconds(10),
        path: "/sbappx1/actuator/health",
        timeout: cdk.Duration.seconds(5),
      },
    });

    // Create a Lambda function to integrate with API Gateway
    const lambdaFunction = new lambda.Function(this, "LambdaFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambda")),
      environment: {
        ALB_DNS_NAME: lb.loadBalancerDnsName,
      },
      vpc: vpc,
    });


    // Create an API Gateway
    const api = new apigateway.RestApi(this, "ApiGateway", {
      restApiName: "sbappServiceApi",
      description: "API Gateway to access sbapp service running on ECS Fargate",
    });

    // Create a GET method
    const getIntegration = new apigateway.LambdaIntegration(lambdaFunction);
    api.root.addMethod("GET", getIntegration);


    // Create REST resources
    const mainResource = api.root.addResource('sbappx1');
    const acctuatorResource = mainResource.addResource('actuator');
    const healthResource = acctuatorResource.addResource("health");

    healthResource.addMethod("GET", getIntegration);

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: lb.loadBalancerDnsName,
    });
  }
}
