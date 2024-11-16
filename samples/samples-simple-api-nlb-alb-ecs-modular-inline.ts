import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { QSNetworkStack } from "../lib/qs-network-stack";
import * as ecr from "aws-cdk-lib/aws-ecr"; // Import ECR repository
import { QSClusterMain } from "../lib/qs-ecs-cluster";
import { QSTaskMain } from "../lib/qs-ecs-task";
import {
  IQSAppLoadBalancer,
  QSAppLoadBalancerMain,
} from "../lib/qs-ecs-apploadbalancer";
import {
  IQSNetworkLoadBalancer,
  QSNetworkLoadBalancerMain,
} from "../lib/qs-ecs-networkloadbalancer";
import { QSApiGatewayMain } from "../lib/qs-ecs-apigateway";

export class EcsCdkSimpleApiNlbAlbEcsModularDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

     // Apply tags to the entire stack
     cdk.Tags.of(this).add("Environment", "Production");
     cdk.Tags.of(this).add("Owner", "Quickysoft");
     
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
    let namespace = "sb-app-shared-namespace";
    //Create the cluster, roles and namespaces
    const clusterConstruct = new QSClusterMain(this, "sb-app-cluster", {
      serviceClusterName: "svcCluster1",
      network: clusterNetworkStack.network,
      stackName: "sbApp",
      serviceDiscoveryNamespace: namespace,
    });

    // Create an ECS cluster
    const cluster = clusterConstruct.cluster;
    // Create a Cloud Map namespace for service discovery
    const springbootAppNamespace = clusterConstruct.appNamespace;
    // Task Execution Role with AmazonECSTaskExecutionRolePolicy attached
    const taskExecutionRole = clusterConstruct.taskExecutionRole;
    //security group
    const ecsSecurityGroup =
      clusterNetworkStack.network.preconfiguredVpcCidrAccessHttpSecurityGroup;

    const privateEcrRepo = ecr.Repository.fromRepositoryName(
      this,
      "privateEcrRepo",
      "sample-spring-boot-app"
    );

    const envParams : {[key:string]: string} = {
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://localhost/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://localhost/backend/api/greet`,
      APP_CONTEXT_PATH: "/backend",
    };

    const backendTaskName = "backend";
    const backendTask: QSTaskMain = new QSTaskMain(this, backendTaskName, {
      stackName: this.stackName,
      taskName: backendTaskName,
      cluster: clusterConstruct.cluster,
      memoryLimitMiB: 1024,
      cpu: 512,
      repo: privateEcrRepo,
      repoTag: "latest",
      mappedPort: 80,
      desiredCount: 1,
      securityGroup:
        clusterNetworkStack.network.preconfiguredVpcCidrAccessHttpSecurityGroup,
      taskExecutionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
      taskRole: clusterConstruct.taskRole,
      //**** use the following flags ****
      useServiceDiscovery: false,
      useServiceConnectProxy: true,
      serviceDiscoveryNamespace: springbootAppNamespace,

      environmentVars: envParams,

      isAutoscalingEnabled: true,
      autoscalingCPUPercentage: 80,
      autoscalingMemoryPercentage: 90,
      autoscalingRequestsPerTarget: 200, 
      autoscalingMinCapacity:1,
      autoscalingMaxCapacity:3
    });
    console.log("backendTask added.");

    const appLoadBalancerConstruct: IQSAppLoadBalancer =
      new QSAppLoadBalancerMain(this, this.stackName + "ALBConstruct", {
        stackName: this.stackName,
        vpc: vpc,
        internetFacing: false,
        port: 80,
        open: true,
        securityGroup: ecsSecurityGroup,
      });
    const backendTarget = appLoadBalancerConstruct.addListenerTarget(
      "backend",
      80,
      backendTask.service,
    );

    //Add tags to ALB target and service tasks as they do not automatically get applied
    cdk.Tags.of(backendTask).add("Environment", "Production");
    cdk.Tags.of(backendTask).add("Owner", "Quickysoft");
    cdk.Tags.of(backendTarget).add("Environment", "Production");
    cdk.Tags.of(backendTarget).add("Owner", "Quickysoft");

    const nlbConstruct: IQSNetworkLoadBalancer = new QSNetworkLoadBalancerMain(
      this,
      this.stackName + "NLBConstruct",
      {
        stackName: this.stackName,
        vpc: vpc,
        internetFacing: true,
        port: 80,
        open: true,
        applicationListener: appLoadBalancerConstruct.applicationListener,
      }
    );

    const apiName = "FrontEndSpringBootAppServiceApi";
    // Create a VPC Link for API Gateway
    const vpcLink = new apigateway.VpcLink(this, "VpcLink", {
      vpcLinkName: this.stackName + "vpclink",
      targets: [nlbConstruct.appNlb],
    });

    //API Gateway construct added
    const apiCostruct = new QSApiGatewayMain(this, "Test API Gateway Construct", {
      apiName: apiName,
      appNlb: nlbConstruct.appNlb,
      stackName: this.stackName,
      integrationHttpMethod: "ANY",
      apiKeyRequired: true,
      vpcLink: vpcLink,
    });

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: nlbConstruct.appNlb.loadBalancerDnsName,
    });

  }
}