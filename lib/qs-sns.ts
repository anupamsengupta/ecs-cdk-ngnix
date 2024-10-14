import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as sns from "aws-cdk-lib/aws-sns";

export interface QSSnsQueueProps {
  stackName: string;
  topicName: string;

  fifo?: boolean;
  retentionPeriod?: number;
  contentBasedDeduplication?: boolean;
}

export interface IQSSnsTopic {
  readonly topic: sns.Topic;
}

export class QSSnsTopicConstruct extends Construct implements IQSSnsTopic {
  public readonly topic: sns.Topic;

  public constructor(scope: Construct, id: string, props: QSSnsQueueProps) {
    super(scope, id);
    if (props.fifo == undefined) {
      props.fifo = false;
    }
    if (props.retentionPeriod == undefined) {
      props.retentionPeriod = 5;
    }
    if (props.contentBasedDeduplication == undefined) {
      props.contentBasedDeduplication = false;
    }
    if (!props.fifo) {
      this.topic = new sns.Topic(this, props.stackName + props.topicName, {
        topicName: props.topicName,
      });
    } else {
      this.topic = new sns.Topic(this, props.stackName + props.topicName, {
        topicName: props.topicName,
        fifo : props.fifo,
        contentBasedDeduplication : props.contentBasedDeduplication,
        messageRetentionPeriodInDays : props.retentionPeriod,
      });
    }
  }
}
