import { Construct } from "constructs";
import { Tags } from "aws-cdk-lib";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery"; // Import Cloud Map
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr"; // Import ECR repository
import { IRepository } from "aws-cdk-lib/aws-ecr/lib/repository";
import * as iam from "aws-cdk-lib/aws-iam";
import { IQSCluster } from "./qs-ecs-cluster";

export interface QSTaskProps {
  stackName: string;
  taskName:string;
  cluster: ecs.ICluster;
  memoryLimitMiB: number;
  cpu: number;
  repo: IRepository;
  repoTag: string;
  mappedPort: number;
  desiredCount: number;
  securityGroup: ec2.ISecurityGroup;
  executionRole: iam.Role;
  serviceDiscoveryNamespace: servicediscovery.INamespace;
  DB_URL: string;
  secretsmanagerkey: string;
  EXTERNAL_GET_URL1: string;
  EXTERNAL_GET_URL2: string;
}

export interface IQSTask {
  readonly service: ecs.FargateService;
  readonly taskname: string;
}

export class QSTaskMain extends Construct implements IQSTask {
  public readonly service: ecs.FargateService;
  public readonly taskname: string;

  public constructor(scope: Construct, id: string, props: QSTaskProps) {
    super(scope, id);

    // Create a Fargate task definition for Backend
    const backendServiceTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      props.taskName + 'TaskDef',
      {
        memoryLimitMiB: props.memoryLimitMiB,
        cpu: props.cpu,
        executionRole: props.executionRole, // Set execution role for ECR pull
      }
    );

    const containerName = props.taskName + 'Container';
    const backendServiceContainer = backendServiceTaskDefinition.addContainer(
      containerName,
      {
        image: ecs.ContainerImage.fromEcrRepository(props.repo, props.repoTag), // Specify tag if needed
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: containerName }),
        environment: {
          DB_URL: "db@serviceIP:onPort",
          secretsmanagerkey: "secretsmanagerkey_value",
          APP_CONTEXT_PATH: '/' + props.taskName,
          EXTERNAL_GET_URL1: props.EXTERNAL_GET_URL1,
          EXTERNAL_GET_URL2: props.EXTERNAL_GET_URL2,
        },
        portMappings: [{ containerPort: props.mappedPort }],
      }
    );

    // Create a Fargate service for Backend
    this.service = new ecs.FargateService(this, props.taskName + "Service", {
      cluster: props.cluster,
      taskDefinition: backendServiceTaskDefinition,
      desiredCount: 1,
      securityGroups: [props.securityGroup],
      cloudMapOptions: {
        name: props.taskName + 'api',
        cloudMapNamespace: props.serviceDiscoveryNamespace,
      },
    });

  }
}
