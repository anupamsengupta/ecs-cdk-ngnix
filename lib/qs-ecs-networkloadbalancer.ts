import { Construct } from "constructs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as cdk from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IQSAppLoadBalancer } from "./qs-ecs-apploadbalancer";
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
}

export interface IQSNetworkLoadBalancer {
  readonly appNlb: elbv2.NetworkLoadBalancer;
}

export class QSNetworkLoadBalancerMain
  extends Construct
  implements IQSNetworkLoadBalancer
{
  public readonly appNlb: elbv2.NetworkLoadBalancer;

  public constructor(
    scope: Construct,
    id: string,
    props: QSNetworkLoadBalancerProps
  ) {
    super(scope, id);
    
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
        interval: cdk.Duration.seconds(30),
        path: "/" + props.defaulListenerTargetName + "/actuator/health",
        timeout: cdk.Duration.seconds(10),
      },
    });
    
  }

}
