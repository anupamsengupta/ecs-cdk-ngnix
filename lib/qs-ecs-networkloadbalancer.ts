import { Construct } from "constructs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as cdk from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { AlbListenerTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import { ApplicationListener } from 'aws-cdk-lib/aws-elasticloadbalancingv2/lib';


export interface QSNetworkLoadBalancerProps {
  stackName: string;
  vpc: IVpc;
  internetFacing: boolean;
  port: number;
  open: boolean;
  applicationListener: ApplicationListener;
  defaulListenerTargetName: string,

  unhealthyThresholdCount ? : number;
  healthCheckInterval?: number;
  timeout?: number;
}

export interface IQSNetworkLoadBalancer {
  readonly appNlb: elbv2.NetworkLoadBalancer;
  readonly props : QSNetworkLoadBalancerProps;
}

export class QSNetworkLoadBalancerMain
  extends Construct
  implements IQSNetworkLoadBalancer
{
  public readonly appNlb: elbv2.NetworkLoadBalancer;
  readonly props : QSNetworkLoadBalancerProps;

  public constructor(
    scope: Construct,
    id: string,
    props: QSNetworkLoadBalancerProps
  ) {
    super(scope, id);
    
    //add meaningful defaults
    if (props.unhealthyThresholdCount == undefined) {
      props.unhealthyThresholdCount = 10;
    }
    if (props.healthCheckInterval == undefined) {
      props.healthCheckInterval = 15;
    }
    if (props.timeout == undefined) {
      props.timeout = 8;
    }
    this.props = props;

    //Create the NLB
    this.appNlb = new elbv2.NetworkLoadBalancer(this, props.stackName + 'NLB', {
      vpc: props.vpc,
      internetFacing: props.internetFacing,
    });

    const nlbListener = this.appNlb.addListener(props.stackName + "NLBListener", {
      port: props.port,
    });

    //add the ALB listener target that can be used with teh NLB.
    const albTarget = new AlbListenerTarget(
      props.applicationListener
    );

    nlbListener.addTargets("EcsTg", {
      port: props.port,
      targets: [albTarget],
      protocol: elbv2.Protocol.TCP,
      healthCheck: {
        interval: cdk.Duration.seconds(props.healthCheckInterval),
        path: "/" + props.defaulListenerTargetName + "/actuator/health",
        timeout: cdk.Duration.seconds(props.timeout),
        unhealthyThresholdCount: props.unhealthyThresholdCount,
      },
    });
    
  }

}
