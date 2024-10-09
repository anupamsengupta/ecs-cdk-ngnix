import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ecr from 'aws-cdk-lib/aws-ecr';  // Import ECR repository

import { QSNetworkStack } from "./qs-network-stack";
import { QSClusterMain } from "./qs-ecs-cluster";
import { IQSTask, QSTaskMain } from "./qs-ecs-task";
import { IQSAppLoadBalancer, QSAppLoadBalancerMain } from "./qs-ecs-apploadbalancer";

export class EcsCdkSBAppDirectStackSimple extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const lambdaTimeoutSeconds = 15; //TO-DO need to go to props

    // Create a VPC and overall network
    const clusterNetworkStack = new QSNetworkStack(
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
    const vpc: ec2.IVpc = clusterNetworkStack.network.vpc;
    const ecsSecurityGroup = clusterNetworkStack.network.preconfiguredVpcCidrAccessHttpSecurityGroup;

    let namespace = 'springBootAppSharedPrivateNamespace';
    //Create the cluster, roles and namespaces
    const clusterConstruct = new QSClusterMain(
      this,
      'sbAppCluster', {
        network: clusterNetworkStack.network,
        stackName: 'sbApp',
        serviceDiscoveryNamespace: namespace,
      }
    );

    // Create an ECS cluster
    const cluster = clusterConstruct.cluster;
    // Create a Cloud Map namespace for service discovery
    const springbootAppNamespace = clusterConstruct.appNamespace;
    // Task Execution Role with AmazonECSTaskExecutionRolePolicy attached
    const taskExecutionRole = clusterConstruct.taskExecutionRole;

    const privateEcrRepo: ecr.IRepository = clusterConstruct.getRepo(
      this,
      "privateEcrRepo",
      "quickysoft/sample-spring-boot-app"
    );

    const backendTask : IQSTask = new QSTaskMain(
      this,
      'backend', {
        stackName: this.stackName,
        taskName: 'backend',
        cluster: clusterConstruct.cluster,
        memoryLimitMiB: 512,
        cpu:256,
        repo: privateEcrRepo,
        repoTag: 'latest',
        mappedPort: 80,
        desiredCount: 1,
        securityGroup: clusterNetworkStack.network.preconfiguredVpcCidrAccessHttpSecurityGroup,
        executionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
        serviceDiscoveryNamespace: springbootAppNamespace,
        DB_URL: "db@serviceIP:onPort",
        secretsmanagerkey: "secretsmanagerkey_value",
        EXTERNAL_GET_URL1: `http://localhost/backend/api/external-api`,
        EXTERNAL_GET_URL2: `http://localhost/backend/api/greet`,
      }
    );

    const frontendTask1 : IQSTask = new QSTaskMain(
      this,
      'sbapp1', {
        stackName: this.stackName,
        taskName: 'sbapp1',
        cluster: clusterConstruct.cluster,
        memoryLimitMiB: 512,
        cpu:256,
        repo: privateEcrRepo,
        repoTag: 'latest',
        mappedPort: 80,
        desiredCount: 1,
        securityGroup: clusterNetworkStack.network.preconfiguredVpcCidrAccessHttpSecurityGroup,
        executionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
        serviceDiscoveryNamespace: springbootAppNamespace,
        DB_URL: "db@serviceIP:onPort",
        secretsmanagerkey: "secretsmanagerkey_value",
        EXTERNAL_GET_URL1: `http://backendapi.springBootAppSharedPrivateNamespace/backend/api/external-api`,
        EXTERNAL_GET_URL2: `http://backendapi.springBootAppSharedPrivateNamespace/backend/api/greet`,
      }
    );


    const frontendTask2 : IQSTask = new QSTaskMain(
      this,
      'sbapp2', {
        stackName: this.stackName,
        taskName: 'sbapp2',
        cluster: clusterConstruct.cluster,
        memoryLimitMiB: 512,
        cpu:256,
        repo: privateEcrRepo,
        repoTag: 'latest',
        mappedPort: 80,
        desiredCount: 1,
        securityGroup: clusterNetworkStack.network.preconfiguredVpcCidrAccessHttpSecurityGroup,
        executionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
        serviceDiscoveryNamespace: springbootAppNamespace,
        DB_URL: "db@serviceIP:onPort",
        secretsmanagerkey: "secretsmanagerkey_value",
        EXTERNAL_GET_URL1: `http://backendapi.springBootAppSharedPrivateNamespace/backend/api/external-api`,
        EXTERNAL_GET_URL2: `http://backendapi.springBootAppSharedPrivateNamespace/backend/api/greet`,
      }
    );

    const appLoadBalancerConstruct: IQSAppLoadBalancer = new QSAppLoadBalancerMain(
      this,
      this.stackName, {
        stackName: this.stackName,
        vpc: vpc, 
        internetFacing: false,
        port: 80,
        open: true,
        securityGroup: ecsSecurityGroup,
      }
    );
    appLoadBalancerConstruct.addListenerTarget(
      'backend',
      80,
      30,
      5,
      backendTask.service,
      true,
    );
    appLoadBalancerConstruct.addListenerTarget(
      'sbapp1',
      80,
      30,
      5,
      frontendTask1.service,
      false,
    );
    appLoadBalancerConstruct.addListenerTarget(
      'sbapp2',
      80,
      30,
      5,
      frontendTask2.service,
      false,
    );

    // Create a Lambda function to integrate with API Gateway
    const lambdaFunction = new lambda.Function(this, "LambdaFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambda")),
      environment: {
        ALB_DNS_NAME: appLoadBalancerConstruct.appAlb.loadBalancerDnsName,
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
    const mainResource1 = api.root.addResource('sbapp1');
    mainResource1
      .addResource("{proxy+}")
      .addMethod("ANY", lambdaDelegationIntegration, {
        requestParameters: {
          "method.request.path.proxy": true, // Enable path proxying
        },
      });

    const mainResource2 = api.root.addResource('sbapp2');
    mainResource2
    .addResource("{proxy+}")
    .addMethod("ANY", lambdaDelegationIntegration, {
      requestParameters: {
        "method.request.path.proxy": true, // Enable path proxying
      },
    });

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: appLoadBalancerConstruct.appAlb.loadBalancerDnsName,
    });
  }
}
