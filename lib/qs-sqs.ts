import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";

export interface QSSqsQueueProps {
  stackName: string;
  queueName: string;
  deliveryDelay?: cdk.Duration;
  maxMessageSizeBytes?: number;
  receiveMessageWaitTime?: cdk.Duration;
  retentionPeriod?: cdk.Duration;
  visibilityTimeout?: cdk.Duration;

  deadLetterQueueName?: string;
  deadLetterQueueArn?: string;
  maxReceiveCount?: number;
}

export interface IQSSqsQueue {
  readonly q: sqs.Queue;
}

export class QSSqsQueueConstruct extends Construct implements IQSSqsQueue {
  public readonly q: sqs.Queue;

  public constructor(scope: Construct, id: string, props: QSSqsQueueProps) {
    super(scope, id);
    if (props.deliveryDelay == undefined) {
      props.deliveryDelay = cdk.Duration.seconds(2);
    }
    if (props.maxMessageSizeBytes == undefined) {
      props.maxMessageSizeBytes = 1 * 1024;
    }
    if (props.receiveMessageWaitTime == undefined) {
      props.receiveMessageWaitTime = cdk.Duration.seconds(2);
    }
    if (props.retentionPeriod == undefined) {
      props.retentionPeriod = cdk.Duration.days(5);
    }
    if (props.visibilityTimeout == undefined) {
      props.visibilityTimeout = cdk.Duration.minutes(15);
    }
    if (props.maxReceiveCount == undefined) {
      props.maxReceiveCount = 1;
    }

    let deadLetterQueue;
    if (props.deadLetterQueueArn != undefined) {
      deadLetterQueue = sqs.Queue.fromQueueArn(
        this,
        props.stackName + "ExistingDLQ",
        props.deadLetterQueueArn
      );
      this.q = new sqs.Queue(this, props.stackName + props.queueName, {
        queueName: props.queueName,
        deliveryDelay: props.deliveryDelay,
        receiveMessageWaitTime: props.receiveMessageWaitTime,
        retentionPeriod: props.retentionPeriod,
        visibilityTimeout: props.visibilityTimeout,
        maxMessageSizeBytes: props.maxMessageSizeBytes,
        deadLetterQueue: {
          queue: deadLetterQueue,
          maxReceiveCount: props.maxReceiveCount, // After 5 receives, move the message to the DLQ
        },
      });
    } else if (props.deadLetterQueueName != undefined) {
      const deadLetterQueue = new sqs.Queue(
        this,
        props.stackName + props.deadLetterQueueName,
        {
          queueName: props.deadLetterQueueName,
          retentionPeriod: cdk.Duration.days(14),
        }
      );
      this.q = new sqs.Queue(this, props.stackName + props.queueName, {
        queueName: props.queueName,
        deliveryDelay: props.deliveryDelay,
        receiveMessageWaitTime: props.receiveMessageWaitTime,
        retentionPeriod: props.retentionPeriod,
        visibilityTimeout: props.visibilityTimeout,
        maxMessageSizeBytes: props.maxMessageSizeBytes,
        deadLetterQueue: {
          queue: deadLetterQueue,
          maxReceiveCount: props.maxReceiveCount, // After 5 receives, move the message to the DLQ
        },
      });
    } else {
      this.q = new sqs.Queue(this, props.stackName + props.queueName, {
        queueName: props.queueName,
        deliveryDelay: props.deliveryDelay,
        receiveMessageWaitTime: props.receiveMessageWaitTime,
        retentionPeriod: props.retentionPeriod,
        visibilityTimeout: props.visibilityTimeout,
        maxMessageSizeBytes: props.maxMessageSizeBytes,
      });
    }
  }
}
