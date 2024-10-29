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

    //using service discovery
    /*const backendTask: IQSTask = new QSTaskMain(this, "backend", {
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
      taskExecutionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
      taskRole: clusterConstruct.taskRole,
      //**** use the following flags ****
      useServiceDiscovery: true,
      useServiceConnectProxy: false,
      serviceDiscoveryNamespace: springbootAppNamespace,
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://localhost/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://localhost/backend/api/greet`,
    });*/
    
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
      taskExecutionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
      taskRole: clusterConstruct.taskRole,
      //**** use the following flags ****
      useServiceDiscovery: false,
      useServiceConnectProxy: true,
      serviceDiscoveryNamespace: springbootAppNamespace,
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://localhost/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://localhost/backend/api/greet`,
      isAutoscalingEnabled: true,
      autoscalingCPUPercentage: 80,
      autoscalingMemoryPercentage: 90,
      autoscalingRequestsPerTarget: 200, 
      autoscalingMinCapacity:1,
      autoscalingMaxCapacity:3
    });
    console.log("backendTask added.");

    //using service discovery
    /*const frontendTask1: IQSTask = new QSTaskMain(this, "frontend1", {
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
      taskExecutionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
      taskRole: clusterConstruct.taskRole,
      //**** use the following flags ****
      useServiceDiscovery: true,
      useServiceConnectProxy: false,
      serviceDiscoveryNamespace: springbootAppNamespace,
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://backendapi.sbApp-svcCluster1-sb-app-shared-namespace/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://backendapi.sbApp-svcCluster1-sb-app-shared-namespace/backend/api/greet`,
    });
    console.log("frontendTask1 added.");*/

    //using service connect proxy
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
      taskExecutionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
      taskRole: clusterConstruct.taskRole,
      //**** use the following flags ****
      useServiceDiscovery: false,
      useServiceConnectProxy: true,
      serviceDiscoveryNamespace: springbootAppNamespace,
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://api-nlb-alb-modular-demo-stack0backendapi:80/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://api-nlb-alb-modular-demo-stack0backendapi:80/backend/api/greet`,
    });
    console.log("frontendTask1 added.");

    //using service discovery
    /*const frontendTask2: IQSTask = new QSTaskMain(this, "frontend2", {
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
      taskExecutionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
      taskRole: clusterConstruct.taskRole,
      //**** use the following flags ****
      useServiceDiscovery: true,
      useServiceConnectProxy: false,
      serviceDiscoveryNamespace: springbootAppNamespace,
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://backendapi.sbApp-svcCluster1-sb-app-shared-namespace/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://backendapi.sbApp-svcCluster1-sb-app-shared-namespace/backend/api/greet`,
    });*/
    //using service connect proxy
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
      taskExecutionRole: clusterConstruct.taskExecutionRole, // Set execution role for ECR pull
      taskRole: clusterConstruct.taskRole,
      //**** use the following flags ****
      useServiceDiscovery: false,
      useServiceConnectProxy: true,
      serviceDiscoveryNamespace: springbootAppNamespace,
      DB_URL: "db@serviceIP:onPort",
      secretsmanagerkey: "secretsmanagerkey_value",
      EXTERNAL_GET_URL1: `http://api-nlb-alb-modular-demo-stack0backendapi:80/backend/api/external-api`,
      EXTERNAL_GET_URL2: `http://api-nlb-alb-modular-demo-stack0backendapi:80/backend/api/greet`,
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
      15,
      5,
      backendTask.service,
      true
    );
    const frontend1Target = appLoadBalancerConstruct.addListenerTarget(
      "frontend1",
      80,
      15,
      5,
      frontendTask1.service,
      false
    );
    const frontend2Target = appLoadBalancerConstruct.addListenerTarget(
      "frontend2",
      80,
      15,
      5,
      frontendTask2.service,
      false
    );

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

    // Create a VPC Link for API Gateway
    const vpcLink = new apigateway.VpcLink(this, "VpcLink", {
      vpcLinkName: this.stackName + "vpclink",
      targets: [nlbConstruct.appNlb],
    });

    const apiName = "FrontEndSpringBootAppServiceApi";
    // Create an API Gateway
    const api = new apigateway.RestApi(this, "ApiGateway", {
      restApiName: apiName,
      description:
        "API Gateway to access SpringBootApp service running on ECS Fargate",
    });

    // Add a root resource level health check
    const rootIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: "ANY",
      // The URI always needs to be mentioned in back quotes as below
      // Single quote doesnt work.
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

    const items = api.root.addResource("{proxy+}");
    const rootMethod = items.addMethod("ANY", rootIntegration, {
      requestParameters: {
        "method.request.path.proxy": true, // Enable path proxying
      },
    });

    const apiKey = api.addApiKey(this.stackName + api + "APIKey", {
      apiKeyName : this.stackName + api + "APIKey",
    });

    //Usage plan and API Key
    const usagePlan = api.addUsagePlan(this.stackName + api + "UsagePlan", {
      name:  this.stackName + api + "UsagePlan",
      throttle: {
        rateLimit : 5,
        burstLimit : 10,
      },
      quota : {
        limit : 120,
        period : apigateway.Period.WEEK
      }
    });
    usagePlan.addApiKey(apiKey);
    
    usagePlan.addApiStage({
      stage: api.deploymentStage,
      throttle: [
        {
          method: rootMethod, // Apply throttle to the 'GET' method on 'items'
          throttle: {
            rateLimit: 5, // 5 requests per second for this method
            burstLimit: 10,
          },
        },
      ],
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
