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
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery'; // Import Cloud Map

export class EcsCdkSBAppDirectStackSimple extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const lambdaTimeoutSeconds = 15; //TO-DO need to go to props

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

    // Create a Cloud Map namespace for service discovery
    const springbootAppNamespace = new servicediscovery.PrivateDnsNamespace(
      this,
      "springBootAppSharedPrivateNamespace",
      {
        name: "springBootAppSharedPrivateNamespace",
        vpc: vpc,
      }
    );

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

    const backendContainer = backendTaskDefinition.addContainer(
      "backendContainer",
      {
        image: ecs.ContainerImage.fromEcrRepository(privateEcrRepo, "latest"), // Specify tag if needed
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: "BackendContainer" }),
        environment: {
          DB_URL: "db@serviceIP:onPort",
          secretsmanagerkey: "secretsmanagerkey_value",
          APP_CONTEXT_PATH: "/backend",
        },
        portMappings: [{ containerPort: 80 }],
      }
    );

    // Create a Fargate service for Backend
    const backendService = new ecs.FargateService(this, "BackendService", {
      cluster,
      taskDefinition: backendTaskDefinition,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
      cloudMapOptions: {
        name: "backendapi",
        cloudMapNamespace: springbootAppNamespace,
      },
    });


    // Attach AmazonECSTaskExecutionRolePolicy for ECR image pull permissions
    taskExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonECS_FullAccess")
    );

    // Create a Fargate task definition - sbapp-1
    const sbapp1TaskDefinition = new ecs.FargateTaskDefinition(this, "sbapp1TaskDef", {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole, // Set execution role for ECR pull
    });

    // Create a Container to Fargate task definition - sbapp-1
    const sbapp1Container = sbapp1TaskDefinition.addContainer("sbapp1", 
      {
        image: ecs.ContainerImage.fromEcrRepository(privateEcrRepo, "latest"), // Specify tag if needed
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: "sbapp1Container" }),
        environment: {
          DB_URL: "db@serviceIP:onPort",
          secretsmanagerkey: "secretsmanagerkey_value",
          APP_CONTEXT_PATH: "/sbappx1",
          EXTERNAL_GET_URL1: `http://backendapi.springBootAppSharedPrivateNamespace/backend/api/external-api`,
          EXTERNAL_GET_URL2: `http://backendapi.springBootAppSharedPrivateNamespace/backend/api/greet`,
        },
        portMappings: [{ containerPort: 80 }],
      }
    );

    // Create a Fargate service - sbapp-1
    const sbapp1Service = new ecs.FargateService(this, "sbapp1Service", {
      cluster,
      taskDefinition: sbapp1TaskDefinition,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
      cloudMapOptions: {
        name: "sbapp1",
        cloudMapNamespace: springbootAppNamespace,
      },
    });

    // Create a Fargate task definition - sbapp-2
    const sbapp2TaskDefinition = new ecs.FargateTaskDefinition(this, "sbapp2TaskDef", {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole, // Set execution role for ECR pull
    });

    // Create a Container to Fargate task definition - sbapp-1
    const sbapp2Container = sbapp2TaskDefinition.addContainer("sbapp2", 
      {
        image: ecs.ContainerImage.fromEcrRepository(privateEcrRepo, "latest"), // Specify tag if needed
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: "sbapp2Container" }),
        environment: {
          DB_URL: "db@serviceIP:onPort",
          secretsmanagerkey: "secretsmanagerkey_value",
          APP_CONTEXT_PATH: "/sbappx2",
          EXTERNAL_GET_URL1: `http://backendapi.springBootAppSharedPrivateNamespace/backend/api/external-api`,
          EXTERNAL_GET_URL2: `http://backendapi.springBootAppSharedPrivateNamespace/backend/api/greet`,
        },
        portMappings: [{ containerPort: 80 }],
      }
    );

    // Create a Fargate service - sbapp-2
    const sbapp2Service = new ecs.FargateService(this, "sbapp2Service", {
      cluster,
      taskDefinition: sbapp2TaskDefinition,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
      cloudMapOptions: {
        name: "sbapp2",
        cloudMapNamespace: springbootAppNamespace,
      },
    });

    // Create an Application Load Balancer (ALB)
    const sbappAlb = new elbv2.ApplicationLoadBalancer(this, "LB", {
      vpc,
      internetFacing: false,
    });

    const listener = sbappAlb.addListener("sbappListener", {
      port: 80,
      open: true,
    });

    // Attach the ECS service to the ALB
    listener.addTargets("defaultECS", {
      port: 80,
      targets: [sbapp1Service],
      healthCheck: {
        interval: cdk.Duration.seconds(10),
        path: "/sbappx1/actuator/health",
        timeout: cdk.Duration.seconds(5),
      },
    });
    listener.addTargets("sbapp1ECS", {
      port: 80,
      targets: [sbapp1Service],
      conditions: [elbv2.ListenerCondition.pathPatterns(['/sbappx1/*'])],
      priority: 1,
      healthCheck: {
        interval: cdk.Duration.seconds(10),
        path: "/sbappx1/actuator/health",
        timeout: cdk.Duration.seconds(5),
      },
    });
    listener.addTargets("sbapp2ECS", {
      port: 80,
      targets: [sbapp2Service],
      conditions: [elbv2.ListenerCondition.pathPatterns(['/sbappx2/*'])],
      priority: 2,
      healthCheck: {
        interval: cdk.Duration.seconds(10),
        path: "/sbappx2/actuator/health",
        timeout: cdk.Duration.seconds(5),
      },
    });

    // Create a Lambda function to integrate with API Gateway
    const lambdaFunction = new lambda.Function(this, "LambdaFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambda")),
      environment: {
        ALB_DNS_NAME: sbappAlb.loadBalancerDnsName,
      },
      timeout: cdk.Duration.seconds(lambdaTimeoutSeconds),
      vpc: vpc,
      securityGroups: [ecsSecurityGroup],
    });


    // Create an API Gateway
    const api = new apigateway.RestApi(this, "ApiGateway", {
      restApiName: "sbappServiceApi",
      description: "API Gateway to access sbapp service running on ECS Fargate",
    });

    // Create a GET method
    const lambdaDelegationIntegration = new apigateway.LambdaIntegration(lambdaFunction);
    api.root.addMethod("GET", lambdaDelegationIntegration);


    // Create REST resources
    const mainResource1 = api.root.addResource('sbappx1');
    mainResource1
      .addResource("{proxy+}")
      .addMethod("ANY", lambdaDelegationIntegration, {
        requestParameters: {
          "method.request.path.proxy": true, // Enable path proxying
        },
      });

    const mainResource2 = api.root.addResource('sbappx2');
    mainResource2
    .addResource("{proxy+}")
    .addMethod("ANY", lambdaDelegationIntegration, {
      requestParameters: {
        "method.request.path.proxy": true, // Enable path proxying
      },
    });

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: sbappAlb.loadBalancerDnsName,
    });
  }
}
