import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { QSNetworkStack } from "../lib/qs-network-stack";
import * as ecr from 'aws-cdk-lib/aws-ecr';  // Import ECR repository
import { QSClusterMain } from "../lib/qs-ecs-cluster";
import { IQSTask, QSTaskMain } from "../lib/qs-ecs-task";
import { IQSAppLoadBalancer, QSAppLoadBalancerMain } from "../lib/qs-ecs-apploadbalancer";
import { IQSNetworkLoadBalancer, QSNetworkLoadBalancerMain } from "../lib/qs-ecs-networkloadbalancer";

export class EcsCdkSimpleApiNlbAlbEcsModularDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC and overall network
    const clusterNetworkStack = new QSNetworkStack(scope, "ecsNetworkStackName1", {
      env: {
        region: "us-east-1",
      },
      vpcCidr: "10.101.0.0/16",
      azs: ["us-east-1a", "us-east-1b"],
    });

    const vpc: ec2.IVpc = clusterNetworkStack.network.vpc;
    let namespace = "springBootAppSharedPrivateNamespace";
    //Create the cluster, roles and namespaces
    const clusterConstruct = new QSClusterMain(this, "sbAppCluster", {
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
      "quickysoft/sample-spring-boot-app"
    );

    const backendTask: IQSTask = new QSTaskMain(this, "backend", {
      stackName: this.stackName,
      taskName: "backend",
      cluster: clusterConstruct.cluster,
      memoryLimitMiB: 512,
      cpu: 256,
      repo: privateEcrRepo,
      repoTag: "latest",
      mappedPort: 80,
      desiredCount: 1,
      securityGroup:
        clusterNetworkStack.network.preconfiguredVpcCidrAccessHttpSecurityGroup,
      executionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
      serviceDiscoveryNamespace: springbootAppNamespace,
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://localhost/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://localhost/backend/api/greet`,
    });

    const frontendTask1: IQSTask = new QSTaskMain(this, "frontend1", {
      stackName: this.stackName,
      taskName: "frontend1",
      cluster: clusterConstruct.cluster,
      memoryLimitMiB: 512,
      cpu: 256,
      repo: privateEcrRepo,
      repoTag: "latest",
      mappedPort: 80,
      desiredCount: 1,
      securityGroup:
        clusterNetworkStack.network.preconfiguredVpcCidrAccessHttpSecurityGroup,
      executionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
      serviceDiscoveryNamespace: springbootAppNamespace,
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://backendapi.sbApp-springBootAppSharedPrivateNamespace/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://backendapi.sbApp-springBootAppSharedPrivateNamespace/backend/api/greet`,
    });

    const frontendTask2: IQSTask = new QSTaskMain(this, "frontend2", {
      stackName: this.stackName,
      taskName: "frontend2",
      cluster: clusterConstruct.cluster,
      memoryLimitMiB: 512,
      cpu: 256,
      repo: privateEcrRepo,
      repoTag: "latest",
      mappedPort: 80,
      desiredCount: 1,
      securityGroup:
        clusterNetworkStack.network.preconfiguredVpcCidrAccessHttpSecurityGroup,
      executionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
      serviceDiscoveryNamespace: springbootAppNamespace,
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://backendapi.sbApp-springBootAppSharedPrivateNamespace/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://backendapi.sbApp-springBootAppSharedPrivateNamespace/backend/api/greet`,
    });

    const appLoadBalancerConstruct: IQSAppLoadBalancer =
      new QSAppLoadBalancerMain(this, this.stackName + 'ALBConstruct', {
        stackName: this.stackName,
        vpc: vpc,
        internetFacing: false,
        port: 80,
        open: true,
        securityGroup: ecsSecurityGroup,
      });
    appLoadBalancerConstruct.addListenerTarget(
      "backend",
      80,
      15,
      5,
      backendTask.service,
      true
    );
    appLoadBalancerConstruct.addListenerTarget(
      "frontend1",
      80,
      15,
      5,
      frontendTask1.service,
      false
    );
    appLoadBalancerConstruct.addListenerTarget(
      "frontend2",
      80,
      15,
      5,
      frontendTask2.service,
      false
    );
    
    const nlbConstruct : IQSNetworkLoadBalancer = new QSNetworkLoadBalancerMain(
      this,
      this.stackName + "NLBConstruct", {
        stackName : this.stackName,
        vpc: vpc,
        internetFacing: true,
        port: 80,
        open: true,
        applicationListener: appLoadBalancerConstruct.applicationListener,
        defaulListenerTargetName: 'backend',
      }
    );

    // Create a VPC Link for API Gateway
    const vpcLink = new apigateway.VpcLink(this, "VpcLink", {
      targets: [nlbConstruct.appNlb],
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
      uri: `http://${nlbConstruct.appNlb.loadBalancerDnsName}/{proxy}`,
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
      value: nlbConstruct.appNlb.loadBalancerDnsName,
    });
  }
}
