import { Construct } from "constructs";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery"; // Import Cloud Map
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { IRepository } from "aws-cdk-lib/aws-ecr/lib/repository";
import * as iam from "aws-cdk-lib/aws-iam";
import { Duration } from "aws-cdk-lib";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cdk from "aws-cdk-lib";

export interface QSTaskProps {
  stackName: string;
  taskName: string;
  cluster: ecs.ICluster;
  repo: IRepository;
  repoTag: string;
  securityGroup: ec2.ISecurityGroup;
  taskExecutionRole: iam.Role;
  taskRole: iam.Role;

  environmentVars: { [key: string]: string };

  memoryLimitMiB?: number;
  cpu?: number;
  mappedPort?: number;
  desiredCount?: number;
  useServiceDiscovery?: boolean;
  useServiceConnectProxy?: boolean;
  serviceDiscoveryNamespace?: servicediscovery.INamespace;

  isAutoscalingEnabled?: boolean;
  autoscalingMinCapacity?: number;
  autoscalingMaxCapacity?: number;
  autoscalingRequestsPerTarget?: number;
  autoscalingCPUPercentage?: number;
  autoscalingMemoryPercentage?: number;
}

export interface IQSTask {
  readonly service: ecs.FargateService;
  readonly taskname: string;
  readonly props : QSTaskProps;

  applyAutoscaling(targetGroup: elbv2.ApplicationTargetGroup): void;
}

export class QSTaskMain extends Construct implements IQSTask {
  public readonly service: ecs.FargateService;
  public readonly taskname: string;
  public readonly props : QSTaskProps;

  public constructor(scope: Construct, id: string, props: QSTaskProps) {
    super(scope, id);

    //add meaningful defaults
    if (props.memoryLimitMiB == undefined) {
      props.memoryLimitMiB = 1024;
    }
    if (props.cpu == undefined) {
      props.cpu = 512;
    }
    if (props.desiredCount == undefined) {
      props.desiredCount = 1;
    }
    if (props.mappedPort == undefined) {
      props.mappedPort = 80;
    }
    if (props.useServiceDiscovery == undefined) {
      props.useServiceDiscovery = false;
    }
    if (props.useServiceConnectProxy == undefined) {
      props.useServiceConnectProxy = false;
    } else {
      if (props.mappedPort == undefined) {
        props.mappedPort = 8080;
      }
    }
    if (props.isAutoscalingEnabled == undefined) {
      props.isAutoscalingEnabled = false;
    }
    this.props = props;

    this.taskname = props.stackName + props.taskName;
    // Create a Fargate task definition for Backend
    const serviceTaskDefinition = new ecs.FargateTaskDefinition(
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
    console.log('LogGroup name : ' + '/ecs/' + containerName + this.taskname + 'LogGroup');
    const logGroup = new logs.LogGroup(this, containerName + this.taskname + 'LogGroup', {
      logGroupName: '/ecs/' + containerName + this.taskname + 'LogGroup',
      retention: logs.RetentionDays.ONE_WEEK, // Set log retention as needed
      removalPolicy: cdk.RemovalPolicy.DESTROY, // This can be set to RETAIN in production
    });

    const serviceContainer = serviceTaskDefinition.addContainer(containerName, {
      containerName: this.taskname,
      image: ecs.ContainerImage.fromEcrRepository(props.repo, props.repoTag), // Specify tag if needed
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: containerName,
        logGroup: logGroup,
      }),
      environment: props.environmentVars,
      //portMappings: [{ containerPort: props.mappedPort }],
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
    });
    serviceContainer.addPortMappings({
      name: props.stackName + props.taskName + "-app-port",
      containerPort: props.mappedPort,
    });

    if (props.useServiceDiscovery) {
      // Create a Fargate service for Backend
      this.service = new ecs.FargateService(this, this.taskname + "Service", {
        serviceName: this.taskname + "Service",
        cluster: props.cluster,
        taskDefinition: serviceTaskDefinition,
        desiredCount: props.desiredCount,
        securityGroups: [props.securityGroup],
        cloudMapOptions: {
          name: props.taskName + "api",
          cloudMapNamespace: props.serviceDiscoveryNamespace,
        },
      });
    } else if (props.useServiceConnectProxy) {
      // Define the Service Connect Configuration for the ECS Service
      const serviceConnectConfiguration: ecs.ServiceConnectProps = {
        namespace: props.serviceDiscoveryNamespace?.namespaceName,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: props.taskName + "api",
        }),
        services: [
          {
            portMappingName: props.stackName + props.taskName + "-app-port", // Name of the port mapping used in the container
            port: props.mappedPort, // Port on the container
            discoveryName: props.stackName + props.taskName + "-app", // Discovery name for service connect
            dnsName: props.stackName + props.taskName + "api",
            //idleTimeout: Duration.minutes(10), //cannot be set for TCP
            //perRequestTimeout: Duration.minutes(10), //cannot be set for TCP
          },
        ],
      };
      this.service = new ecs.FargateService(this, this.taskname + "Service", {
        serviceName: this.taskname + "Service",
        cluster: props.cluster,
        taskDefinition: serviceTaskDefinition,
        desiredCount: props.desiredCount,
        securityGroups: [props.securityGroup],
        serviceConnectConfiguration: serviceConnectConfiguration,
      });
    }
    this.props = props;

    console.log("AlbTargetGroupArn : " + props.taskName + 'AlbTargetGroupArn');
    const targetGroupArn = cdk.Fn.importValue(props.taskName + 'AlbTargetGroupArn');
    const targetGroup = elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(this, 'ImportedTargetGroup', {
      targetGroupArn,
    });
    this.service.attachToApplicationTargetGroup(targetGroup);

  }

  public applyAutoscaling(targetGroup: elbv2.ApplicationTargetGroup): void {
    if (
      this.props.isAutoscalingEnabled &&
      this.props.autoscalingMinCapacity != undefined &&
      this.props.autoscalingMaxCapacity != undefined
    ) {
      const scalableTarget = this.service.autoScaleTaskCount({
        minCapacity: this.props.autoscalingMinCapacity,
        maxCapacity: this.props.autoscalingMaxCapacity,
      });
      if (this.props.autoscalingCPUPercentage != undefined) {
        scalableTarget.scaleOnCpuUtilization("CPUScaling", {
          targetUtilizationPercent: this.props.autoscalingCPUPercentage,
          scaleInCooldown: Duration.seconds(60),
          scaleOutCooldown: Duration.seconds(60),
        });
      }
      if (this.props.autoscalingMemoryPercentage != undefined) {
        scalableTarget.scaleOnMemoryUtilization("MemoryScaling", {
          targetUtilizationPercent: this.props.autoscalingMemoryPercentage,
          scaleInCooldown: Duration.seconds(60),
          scaleOutCooldown: Duration.seconds(60),
        });
      }
      if (this.props.autoscalingRequestsPerTarget != undefined) {
        scalableTarget.scaleOnRequestCount('RequestScaling', {
          requestsPerTarget: 100, // Adjust this based on your needs
          targetGroup: targetGroup,
        });
      }
    }
  }
}
