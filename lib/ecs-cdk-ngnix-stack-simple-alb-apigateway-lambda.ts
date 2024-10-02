import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { QSNetworkStack } from "./qs-network-stack";

export class EcsCdkNgnixStackSimple extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC and overall network
    const networkClusterStack = new QSNetworkStack(
      scope,
      "ecsNetworkClusterStackName",
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

    // Create a Fargate task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    const container = taskDefinition.addContainer("nginx", {
      image: ecs.ContainerImage.fromRegistry("nginx:latest"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "nginx" }),
      environment: {
        'DB_URL': 'db@serviceIP:onPort',
        'secretsmanagerkey': 'secretsmanagerkey_value',
      },
    });

    container.addPortMappings({
      containerPort: 80,
    });

    // Create a Fargate service
    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: 1,
    });

    // Create an Application Load Balancer (ALB)
    const lb = new elbv2.ApplicationLoadBalancer(this, "LB", {
      vpc,
      internetFacing: true,
    });

    const listener = lb.addListener("PublicListener", {
      port: 80,
      open: true,
    });
    // Attach the ECS service to the ALB
    listener.addTargets("ECS", {
      port: 80,
      targets: [service],
      healthCheck: {
        interval: cdk.Duration.seconds(60),
        path: "/",
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
    });


    // Create an API Gateway
    const api = new apigateway.RestApi(this, "ApiGateway", {
      restApiName: "NginxServiceApi",
      description: "API Gateway to access Nginx service running on ECS Fargate",
    });

    // Create a GET method
    const getIntegration = new apigateway.LambdaIntegration(lambdaFunction);
    api.root.addMethod("GET", getIntegration);


    // Create REST resources
    const guestResource = api.root.addResource("guest");
    const addressResource = api.root.addResource("address");

    guestResource.addMethod("GET", getIntegration);
    addressResource.addMethod("GET", getIntegration);

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: lb.loadBalancerDnsName,
    });
  }
}
