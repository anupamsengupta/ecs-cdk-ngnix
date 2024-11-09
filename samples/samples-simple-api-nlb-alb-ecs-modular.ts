import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { QSNetworkStack } from "../lib/qs-network-stack";
import * as ecr from "aws-cdk-lib/aws-ecr"; // Import ECR repository
import { QSClusterMain } from "../lib/qs-ecs-cluster";
import { IQSTask, QSTaskMain } from "../lib/qs-ecs-task";
import {
  IQSAppLoadBalancer,
  QSAppLoadBalancerMain,
} from "../lib/qs-ecs-apploadbalancer";
import {
  IQSNetworkLoadBalancer,
  QSNetworkLoadBalancerMain,
} from "../lib/qs-ecs-networkloadbalancer";
import { QSApiGatewayMain } from "../lib/qs-ecs-apigateway";
import { QSS3BucketConstruct } from "../lib/qs-s3";
import { QSSqsQueueConstruct } from "../lib/qs-sqs";
import { QSSnsTopicConstruct } from "../lib/qs-sns";
import { QSRdsPostgresConstruct } from "../lib/qs-rds-postgress";

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
      "quickysoft/sample-spring-boot-app"
    );

    const envParams : {[key:string]: string} = {
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://localhost/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://localhost/backend/api/greet`,
      APP_CONTEXT_PATH: "/backend",
    };
    //using service discovery
    /*const backendTask: IQSTask = new QSTaskMain(this, "backend", {
      stackName: this.stackName,
      taskName: "backend",
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
      useServiceDiscovery: true,
      useServiceConnectProxy: false,
      serviceDiscoveryNamespace: springbootAppNamespace,

      envParams: envParams,
    });*/
    
    const backendTask: QSTaskMain = new QSTaskMain(this, "backend", {
      stackName: this.stackName,
      taskName: "backend",
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
      
      envParams: envParams,

      isAutoscalingEnabled: true,
      autoscalingCPUPercentage: 80,
      autoscalingMemoryPercentage: 90,
      autoscalingRequestsPerTarget: 200, 
      autoscalingMinCapacity:1,
      autoscalingMaxCapacity:3
    });
    console.log("backendTask added.");

    const envParamsFE1 : {[key:string]: string} = {
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://api-nlb-alb-modular-demo-stack0backendapi:80/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://api-nlb-alb-modular-demo-stack0backendapi:80/backend/api/greet`,
      APP_CONTEXT_PATH: "/frontend1",
    };

    //using service discovery
    /*const frontendTask1: IQSTask = new QSTaskMain(this, "frontend1", {
      stackName: this.stackName,
      taskName: "frontend1",
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
      useServiceDiscovery: true,
      useServiceConnectProxy: false,
      serviceDiscoveryNamespace: springbootAppNamespace,

      envParams: envParamsFE1,
    });
    console.log("frontendTask1 added.");*/

    //using service connect proxy
    const frontendTask1: QSTaskMain = new QSTaskMain(this, "frontend1", {
      stackName: this.stackName,
      taskName: "frontend1",
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

      envParams: envParamsFE1,
    });
    console.log("frontendTask1 added.");

    const envParamsFE2 : {[key:string]: string} = {
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://api-nlb-alb-modular-demo-stack0backendapi:80/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://api-nlb-alb-modular-demo-stack0backendapi:80/backend/api/greet`,
      APP_CONTEXT_PATH: "/frontend2",
    };
    //using service discovery
    /*const frontendTask2: IQSTask = new QSTaskMain(this, "frontend2", {
      stackName: this.stackName,
      taskName: "frontend2",
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
      useServiceDiscovery: true,
      useServiceConnectProxy: false,
      serviceDiscoveryNamespace: springbootAppNamespace,
      
      envParams: envParamsFE2,

    });*/
    //using service connect proxy
    const frontendTask2: QSTaskMain = new QSTaskMain(this, "frontend2", {
      stackName: this.stackName,
      taskName: "frontend2",
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

      envParams: envParamsFE2,
    });
    console.log("frontendTask2 added.");

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
      true
    );
    const frontend1Target = appLoadBalancerConstruct.addListenerTarget(
      "frontend1",
      80,
      frontendTask1.service,
      false
    );
    const frontend2Target = appLoadBalancerConstruct.addListenerTarget(
      "frontend2",
      80,
      frontendTask2.service,
      false
    );

    //Add tags to ALB target and service tasks as they do not automatically get applied
    cdk.Tags.of(backendTask).add("Environment", "Production");
    cdk.Tags.of(backendTask).add("Owner", "Quickysoft");
    cdk.Tags.of(frontendTask1).add("Environment", "Production");
    cdk.Tags.of(frontendTask1).add("Owner", "Quickysoft");
    cdk.Tags.of(frontendTask2).add("Environment", "Production");
    cdk.Tags.of(frontendTask2).add("Owner", "Quickysoft");
    cdk.Tags.of(backendTarget).add("Environment", "Production");
    cdk.Tags.of(backendTarget).add("Owner", "Quickysoft");
    cdk.Tags.of(frontend1Target).add("Environment", "Production");
    cdk.Tags.of(frontend1Target).add("Owner", "Quickysoft");
    cdk.Tags.of(frontend2Target).add("Environment", "Production");
    cdk.Tags.of(frontend2Target).add("Owner", "Quickysoft");

    //Apply autoscaling properties.
    backendTask.applyAutoscaling(backendTarget);
    frontendTask1.applyAutoscaling(frontend1Target);
    frontendTask2.applyAutoscaling(frontend2Target);

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
        defaulListenerTargetName: "backend",
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

    //Add rds construct.
    /*const postgresRds = new QSRdsPostgresConstruct(
      this,
      "testPostgressSQLRDS",
      {
        stackName: this.stackName,
        vpc: clusterNetworkStack.network.vpc,
        databaseName: "testPostgressSQLRDS",
        securityGroup:
          clusterNetworkStack.network
            .preconfiguredVpcCidrAccessRDSPostgressSecurityGroup,
      }
    );*/

    //Add a queue
    const testQueue = new QSSqsQueueConstruct(
      this,
      this.stackName + "com-quickysoft-anu-testqueue-13102024",
      {
        stackName: this.stackName,
        queueName: "com-quickysoft-anu-testqueue-13102024",
        deadLetterQueueName: "com-quickysoft-anu-testqueue-13102024-dlq",
      }
    );

    //Add a sns topic
    const snsQueueConstruct = new QSSnsTopicConstruct(
      this,
      "com-quickysoft-anu-test-14102024",
      {
        stackName: this.stackName,
        topicName: "com-quickysoft-anu-test-14102024",
      }
    );

    //Add a bucket with a event notification to a queue
    const testS3BucketEN = new QSS3BucketConstruct(
      this,
      this.stackName + "com-quickysoft-anu-eventnotification",
      {
        stackName: this.stackName,
        bucketName: "com-quickysoft-anu-eventnotification-bucket",
        eventNotificationEnabled: true,
        notificationQueueName: "com-quickysoft-anu-eventnotification-q",
      }
    );
    //Add a bucket with a event bridge enabled to a queue
    const testS3BucketEB = new QSS3BucketConstruct(
      this,
      this.stackName + "com-quickysoft-anu-eventbridge",
      {
        stackName: this.stackName,
        bucketName: "com-quickysoft-anu-eventbridge-bucket",
        eventBridgeEnabled: true,
        notificationQueueName: "com-quickysoft-anu-eventbridge-q",
      }
    );
  }
}