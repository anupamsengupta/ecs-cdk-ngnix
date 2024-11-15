import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecr from "aws-cdk-lib/aws-ecr"; // Import ECR repository
import { QSNetworkStack } from "../../lib/qs-network-stack";
import { QSClusterMain } from "../../lib/qs-ecs-cluster";
import { QSTaskMain } from "../../lib/qs-ecs-task";
import * as iam from "aws-cdk-lib/aws-iam";

export interface FrontendStackProps  extends cdk.StackProps {
    stackName: string;
    clusterConstruct: QSClusterMain;
    clusterNetworkStack: QSNetworkStack;
    contextPath: string;
}

export class FrontendStack extends cdk.Stack {
    public frontendTask: QSTaskMain;
    public taskName: string;

    constructor(scope: Construct, id: string, frontendProps: FrontendStackProps) {
        super(scope, id, frontendProps);
        // Apply tags to the entire stack
        cdk.Tags.of(this).add("Environment", "Rnd");
        cdk.Tags.of(this).add("billing-code", "ICRQ-1843");

        // Task Execution Role with AmazonECSTaskExecutionRolePolicy attached
        const taskExecutionRole = new iam.Role(this, id + 'TaskExecutionRole', {
            roleName: id + 'TaskExecutionRole',
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        });
        // Attach AmazonECSTaskExecutionRolePolicy for ECR image pull permissions
        taskExecutionRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonECS_FullAccess")
        );

        // Task Execution Role with AmazonS3FullAccess attached
        const taskRole = new iam.Role(this, id + 'TaskRole', {
            roleName: id + 'TaskRole',
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        });
        // Attach AmazonS3FullAccess for ECR image pull permissions
        taskRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess")
        );
        // Attach AmazonSQSFullAccess for ECR image pull permissions
        taskRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSQSFullAccess")
        );
        // Attach AmazonSNSFullAccess for ECR image pull permissions
        taskRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSNSFullAccess")
        );
        // Attach AmazonSNSFullAccess for ECR image pull permissions
        taskRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonRDSDataFullAccess")
        );
        taskRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonEC2RoleforSSM")
        );
        taskRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName("SecretsManagerReadWrite")
        );
        taskRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMFullAccess")
        );

        const privateEcrRepo = ecr.Repository.fromRepositoryName(
            this,
            "privateEcrRepo",
            "sample-spring-boot-app"
        );

        const envParams: { [key: string]: string } = {
            DB_URL: "db@serviceIP:onPort",
            secretsmanagerkey: "secretsmanagerkey_value",
            EXTERNAL_GET_URL1: `http://localhost/backend/api/external-api`,
            EXTERNAL_GET_URL2: `http://localhost/backend/api/greet`,
            APP_CONTEXT_PATH: "/" + frontendProps.contextPath,
        };

        // Create a Cloud Map namespace for service discovery
        const springbootAppNamespace = frontendProps.clusterConstruct.appNamespace;
        this.taskName = frontendProps.contextPath;

        this.frontendTask = new QSTaskMain(this, this.taskName, {
            stackName: this.stackName,
            taskName: this.taskName,
            cluster: frontendProps.clusterConstruct.cluster,
            memoryLimitMiB: 1024,
            cpu: 512,
            repo: privateEcrRepo,
            repoTag: "latest",
            mappedPort: 80,
            desiredCount: 1,
            securityGroup:
                frontendProps.clusterNetworkStack.network.preconfiguredVpcCidrAccessHttpSecurityGroup,
            taskExecutionRole: taskExecutionRole, // Set execution role for ECR pull
            taskRole: taskRole,
            //**** use the following flags ****
            useServiceDiscovery: false,
            useServiceConnectProxy: true,
            serviceDiscoveryNamespace: springbootAppNamespace,

            environmentVars: envParams,

            isAutoscalingEnabled: true,
            autoscalingCPUPercentage: 80,
            autoscalingMemoryPercentage: 90,
            autoscalingRequestsPerTarget: 200,
            autoscalingMinCapacity: 1,
            autoscalingMaxCapacity: 3,
        });
        cdk.Tags.of(this.frontendTask).add("Environment", "RnD");
        cdk.Tags.of(this.frontendTask).add("billing-code", "ICRQ-1843");

        console.log("frontendTask added.");
    }
}