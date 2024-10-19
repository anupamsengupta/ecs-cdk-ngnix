import { Construct } from "constructs";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery"; // Import Cloud Map
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { IRepository } from "aws-cdk-lib/aws-ecr/lib/repository";
import * as iam from "aws-cdk-lib/aws-iam";

export interface QSTaskProps {
  stackName: string;
  taskName: string;
  cluster: ecs.ICluster;
  memoryLimitMiB: number;
  cpu: number;
  repo: IRepository;
  repoTag: string;
  mappedPort: number;
  desiredCount: number;
  securityGroup: ec2.ISecurityGroup;
  taskExecutionRole: iam.Role;
  taskRole: iam.Role;
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

    this.taskname = props.stackName + props.taskName;
    // Create a Fargate task definition for Backend
    const backendServiceTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      this.taskname + "TaskDef",
      {
        memoryLimitMiB: props.memoryLimitMiB,
        cpu: props.cpu,
        executionRole: props.taskExecutionRole, // Set execution role for ECR pull
        taskRole: props.taskRole,
      }
    );

    const containerName = this.taskname + "Container";
    const backendServiceContainer = backendServiceTaskDefinition.addContainer(
      containerName,
      {
        containerName: this.taskname,
        image: ecs.ContainerImage.fromEcrRepository(props.repo, props.repoTag), // Specify tag if needed
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: containerName }),
        environment: {
          DB_URL: "db@serviceIP:onPort",
          secretsmanagerkey: "secretsmanagerkey_value",
          APP_CONTEXT_PATH: "/" + props.taskName,
          EXTERNAL_GET_URL1: props.EXTERNAL_GET_URL1,
          EXTERNAL_GET_URL2: props.EXTERNAL_GET_URL2,
        },
        portMappings: [{ containerPort: props.mappedPort }],
        //Dont know how to make thsi work!!!!!
        /*healthCheck: {
          command: [
            "CMD-SHELL",
            "curl -f http://127.0.0.1/" + props.taskName + "/actuator/health || exit 1",
          ],
          interval : cdk.Duration.seconds(15),
          retries : 5,
          timeout : cdk.Duration.seconds(5),
          startPeriod : cdk.Duration.seconds(30),
        },*/
      }
    );

    // Create a Fargate service for Backend
    this.service = new ecs.FargateService(this, this.taskname + "Service", {
      serviceName: this.taskname + "Service",
      cluster: props.cluster,
      taskDefinition: backendServiceTaskDefinition,
      desiredCount: 1,
      securityGroups: [props.securityGroup],
      cloudMapOptions: {
        name: props.taskName + "api",
        cloudMapNamespace: props.serviceDiscoveryNamespace,
      },
    });
  }
}
