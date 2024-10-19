import { Construct } from "constructs";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery"; // Import Cloud Map
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr"; // Import ECR repository
import { IRepository } from "aws-cdk-lib/aws-ecr/lib/repository";
import * as iam from "aws-cdk-lib/aws-iam";
import { IQSNetwork } from "./qs-network";

export interface QSClusterProps {
  stackName: string;
  serviceClusterName: string;
  network: IQSNetwork;
  serviceDiscoveryNamespace: string;
}

export interface IQSCluster {
  readonly cluster: ecs.ICluster;
  readonly taskExecutionRole: iam.Role;
  readonly taskRole: iam.Role;
  readonly appNamespace: servicediscovery.PrivateDnsNamespace;
}

export class QSClusterMain extends Construct implements IQSCluster {
  public readonly cluster: ecs.ICluster;
  public readonly taskExecutionRole: iam.Role;
  public readonly taskRole: iam.Role;
  public readonly appNamespace: servicediscovery.PrivateDnsNamespace;

  public constructor(scope: Construct, id: string, props: QSClusterProps) {
    super(scope, id);

    //extract teh vpc from presupplied vpc.
    const vpc: ec2.IVpc = props.network.vpc;

    // Create an ECS cluster
    this.cluster = new ecs.Cluster(this, props.stackName + props.serviceClusterName, {
      clusterName: props.stackName + props.serviceClusterName,
      vpc: vpc,
    });

    // Create a Cloud Map namespace for service discovery
    this.appNamespace = new servicediscovery.PrivateDnsNamespace(
      this,
      props.stackName + "-" + props.serviceClusterName + "-" + props.serviceDiscoveryNamespace,
      {
        name: props.stackName + "-" + props.serviceClusterName + "-" + props.serviceDiscoveryNamespace,
        vpc: vpc,
      }
    );

    // Task Execution Role with AmazonECSTaskExecutionRolePolicy attached
    this.taskExecutionRole = new iam.Role(this, props.stackName + props.serviceClusterName + 'TaskExecutionRole', {
      roleName: props.stackName + props.serviceClusterName + 'TaskExecutionRole',
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    // Attach AmazonECSTaskExecutionRolePolicy for ECR image pull permissions
    this.taskExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonECS_FullAccess")
    );

    // Task Execution Role with AmazonS3FullAccess attached
    this.taskRole = new iam.Role(this, props.stackName + props.serviceClusterName + 'TaskRole', {
      roleName: props.stackName + props.serviceClusterName + 'TaskRole',
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    // Attach AmazonS3FullAccess for ECR image pull permissions
    this.taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess")
    );
    // Attach AmazonSQSFullAccess for ECR image pull permissions
    this.taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSQSFullAccess")
    );
    // Attach AmazonSNSFullAccess for ECR image pull permissions
    this.taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSNSFullAccess")
    );
    // Attach AmazonSNSFullAccess for ECR image pull permissions
    this.taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonRDSDataFullAccess")
    );
    
  }

  public getRepo(scope: Construct, id: string, repoName: string) : IRepository {
    const privateEcrRepo = ecr.Repository.fromRepositoryName(
        this,
        id,
        repoName
      );
      return privateEcrRepo;
  }
}
