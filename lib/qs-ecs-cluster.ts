import { Construct } from "constructs";
import { Tags } from "aws-cdk-lib";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery"; // Import Cloud Map
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr"; // Import ECR repository
import { IRepository } from "aws-cdk-lib/aws-ecr/lib/repository";
import * as iam from "aws-cdk-lib/aws-iam";
import { IQSNetwork } from "./qs-network";

export interface QSClusterProps {
  stackName: string;
  network: IQSNetwork;
  serviceDiscoveryNamespace: string;
}

export interface IQSCluster {
  readonly cluster: ecs.ICluster;
  readonly taskExecutionRole: iam.Role;
  readonly appNamespace: servicediscovery.PrivateDnsNamespace;
}

export class QSClusterMain extends Construct implements IQSCluster {
  public readonly cluster: ecs.ICluster;
  public readonly taskExecutionRole: iam.Role;
  public readonly appNamespace: servicediscovery.PrivateDnsNamespace;

  public constructor(scope: Construct, id: string, props: QSClusterProps) {
    super(scope, id);

    //extract teh vpc from presupplied vpc.
    const vpc: ec2.IVpc = props.network.vpc;

    // Create an ECS cluster
    this.cluster = new ecs.Cluster(this, props.stackName + 'ECS-Cluster', {
      vpc: vpc,
    });

    // Create a Cloud Map namespace for service discovery
    this.appNamespace = new servicediscovery.PrivateDnsNamespace(
      this,
      props.stackName + "-" + props.serviceDiscoveryNamespace,
      {
        name: props.stackName + "-" + props.serviceDiscoveryNamespace,
        vpc: vpc,
      }
    );

    // Task Execution Role with AmazonECSTaskExecutionRolePolicy attached
    this.taskExecutionRole = new iam.Role(this, props.stackName + 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    // Attach AmazonECSTaskExecutionRolePolicy for ECR image pull permissions
    this.taskExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonECS_FullAccess")
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
