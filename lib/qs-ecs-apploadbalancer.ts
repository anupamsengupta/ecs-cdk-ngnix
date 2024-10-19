import { Construct } from "constructs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as cdk from "aws-cdk-lib";
import { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";

export interface QSAppLoadBalancerProps {
  stackName: string;
  vpc: IVpc;
  internetFacing: boolean;
  port: number;
  open: boolean;
  securityGroup: ISecurityGroup;
}

export interface IQSAppLoadBalancer {
  readonly appAlb: elbv2.ApplicationLoadBalancer;
  readonly applicationListener: elbv2.ApplicationListener;
  
  addListenerTarget(
    taskname: string,
    port: number,
    healthCheckInterval: number,
    timeout: number,
    service: ecs.FargateService,
    defaultTarget: boolean,
  ) : elbv2.ApplicationTargetGroup;
}

export class QSAppLoadBalancerMain
  extends Construct
  implements IQSAppLoadBalancer
{
  public readonly appAlb: elbv2.ApplicationLoadBalancer;
  public readonly applicationListener: elbv2.ApplicationListener;
  priority: number;

  public constructor(
    scope: Construct,
    id: string,
    props: QSAppLoadBalancerProps
  ) {
    super(scope, id);
    // Create an Application Load Balancer (ALB)
    this.appAlb = new elbv2.ApplicationLoadBalancer(
      this,
      props.stackName + "Alb",
      {
        vpc: props.vpc,
        internetFacing: props.internetFacing,
        securityGroup: props.securityGroup,
      },
    );

    this.applicationListener = this.appAlb.addListener(
      props.stackName + "Listener",
      {
        port: 80,
        open: props.open,
      }
    );
    console.log('this.appAlb : ' + this.appAlb);
    this.priority = 1;
  }

  public addListenerTarget(
    taskname: string,
    port: number,
    healthCheckInterval: number,
    timeout: number,
    service: ecs.FargateService,
    defaultTarget: boolean,
  ) : elbv2.ApplicationTargetGroup {
    // Attach the ECS service to the ALB
    let  appTragetGroup;
    console.log('this.appAlb : ' + this.appAlb);
    console.log('this.applicationListener : ' + this.applicationListener);
    if(defaultTarget) {
      appTragetGroup = this.applicationListener.addTargets(taskname + 'ListenerTarget', {
        port: port,
        targets: [service],
        healthCheck: {
          interval: cdk.Duration.seconds(healthCheckInterval),
          path: "/" + taskname + "/actuator/health",
          timeout: cdk.Duration.seconds(timeout),
        },
      });
    } else {
      appTragetGroup = this.applicationListener.addTargets(taskname + 'ListenerTarget', {
        port: port,
        targets: [service],
        conditions: [elbv2.ListenerCondition.pathPatterns(['/' + taskname + '*'])],
        priority: this.priority++,
        healthCheck: {
          interval: cdk.Duration.seconds(healthCheckInterval),
          path: "/" + taskname + "/actuator/health",
          timeout: cdk.Duration.seconds(timeout),
        },
      });
    }
    console.log('appTragetGroup : ' + appTragetGroup);
    return appTragetGroup;
  }
}
