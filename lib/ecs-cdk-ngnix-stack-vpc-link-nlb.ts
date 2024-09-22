import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { QSNetworkStack } from "./qs-network-stack";

export class EcsCdkNgnixStackVPCLinkAndNLB extends cdk.Stack {
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

    // Create a Fargate task definition
    const nginixTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 256,
      }
    );

    const nginxContainer = nginixTaskDefinition.addContainer("nginx", {
      image: ecs.ContainerImage.fromRegistry("nginx:latest"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "nginx" }),
      environment: {
        DB_URL: "db@serviceIP:onPort",
        secretsmanagerkey: "secretsmanagerkey_value",
      },
    });

    nginxContainer.addPortMappings({
      containerPort: 80,
    });

    // Create a Fargate service
    const nginxService = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition: nginixTaskDefinition,
      desiredCount: 1,
      securityGroups: [ecsSecurityGroup],
    });

    // Create a Fargate task definition for Backend
    const backendTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "BackendTaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 256,
      }
    );

    const backendContainer = backendTaskDefinition.addContainer("backend", {
      image: ecs.ContainerImage.fromRegistry("amazonlinux:2"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "backend" }),
      environment: {
        NGINX_SERVICE_URL: `http://${nginxService.serviceName}`,
      },
    });

    backendContainer.addPortMappings({
      containerPort: 8080,
    });

    // Create a Fargate service for Backend
    const backendService = new ecs.FargateService(this, "BackendService", {
      cluster,
      taskDefinition: backendTaskDefinition,
      desiredCount: 1,
    });

    const nlb = new elbv2.NetworkLoadBalancer(this, "LB", {
      vpc,
      internetFacing: true,
    });

    const listener = nlb.addListener("PublicListener", {
      port: 80,
    });

    listener.addTargets("ECS", {
      port: 80,
      targets: [nginxService],
      //preserveClientIp: true,
    });

    // Create a VPC Link for API Gateway
    const vpcLink = new apigateway.VpcLink(this, "VpcLink", {
      targets: [nlb],
    });

    // Create an API Gateway
    const api = new apigateway.RestApi(this, "ApiGateway", {
      restApiName: "NginxServiceApi",
      description: "API Gateway to access Nginx service running on ECS Fargate",
    });

    // Create GET methods with VPC Link integration for each resource
    const integration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: "GET",
      uri: `http://${nlb.loadBalancerDnsName}`,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink,
      },
    });

    // Create REST resources
    const guestResource = api.root.addResource("guest");
    const addressResource = api.root.addResource("address");

    guestResource.addMethod("GET", integration);
    addressResource.addMethod("GET", integration);

    // Add a root resource level health check

    const rootIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: "GET",
      uri: `http://${nlb.loadBalancerDnsName}`,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink,
      },
    });

    api.root.addMethod("GET", rootIntegration);

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: nlb.loadBalancerDnsName,
    });
  }
}
