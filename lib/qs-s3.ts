import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as events from "aws-cdk-lib/aws-events";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3Notifications from "aws-cdk-lib/aws-s3-notifications";

export interface QSS3BucketProps {
  stackName: string;
  bucketName: string;
  bucketPublicAccess?: s3.BlockPublicAccess;
  publicReadAccess?: boolean;
  removalPolicy?: cdk.RemovalPolicy;
  versioned?: boolean;
  eventBridgeEnabled?: boolean;
  eventNotificationEnabled?: boolean;

  notificationQueueArn?: string;
  notificationQueueName?: string;
  notificationQueueVisibilityTO?: number;
  notificationQueueRetentionPeriod?: number;
}

export interface IQSS3Bucket {
  readonly bucket: s3.Bucket;
}

export class QSS3BucketConstruct extends Construct implements IQSS3Bucket {
  public readonly bucket: s3.Bucket;
  public constructor(scope: Construct, id: string, props: QSS3BucketProps) {
    super(scope, id);
    if (props.bucketPublicAccess == undefined) {
      props.bucketPublicAccess = s3.BlockPublicAccess.BLOCK_ALL;
    }
    if (props.publicReadAccess == undefined) {
      props.publicReadAccess = false;
    }
    if (props.removalPolicy == undefined) {
      props.removalPolicy = cdk.RemovalPolicy.DESTROY;
    }
    if (props.versioned == undefined) {
      props.versioned = false;
    }
    if (props.eventBridgeEnabled == undefined) {
      props.eventBridgeEnabled = false;
    }
    if (props.notificationQueueVisibilityTO == undefined) {
      props.notificationQueueVisibilityTO = 15;
    }
    if (props.notificationQueueRetentionPeriod == undefined) {
      props.notificationQueueRetentionPeriod = 5;
    }
    console.log("props.stackName : " + props.stackName);
    console.log("props.bucketName : " + props.bucketName);

    this.bucket = new s3.Bucket(this, props.stackName + props.bucketName, {
      bucketName: props.bucketName,
      blockPublicAccess: props.bucketPublicAccess,
      eventBridgeEnabled: props.eventBridgeEnabled,
      publicReadAccess: props.publicReadAccess,
      removalPolicy: props.removalPolicy,
      versioned: props.versioned,
    });
    if (props.eventBridgeEnabled || props.eventNotificationEnabled) {
      if (
        props.notificationQueueArn != undefined ||
        props.notificationQueueName != undefined
      ) {
        let notificationQueue;
        if (props.notificationQueueArn != undefined) {
          notificationQueue = sqs.Queue.fromQueueArn(
            this,
            props.stackName + props.notificationQueueName,
            props.notificationQueueArn
          );
        } else {
          notificationQueue = new sqs.Queue(
            this,
            props.stackName + props.notificationQueueName,
            {
              queueName: props.notificationQueueName,
              visibilityTimeout: cdk.Duration.seconds(
                props.notificationQueueVisibilityTO
              ),
              retentionPeriod: cdk.Duration.days(
                props.notificationQueueRetentionPeriod
              ),
            }
          );
        }

        if (props.eventBridgeEnabled) {
          // Create an EventBridge rule for S3 bucket events
          const rule = new events.Rule(this, "S3EventRule", {
            eventPattern: {
              source: ["aws.s3"],
              detailType: ["Object Created"], // You can specify other events like 'Object Removed' here
              detail: {
                bucket: {
                  name: [this.bucket.bucketName],
                },
              },
            },
          });

          // Add the SQS queue as the target for the EventBridge rule
          rule.addTarget(new targets.SqsQueue(notificationQueue));

          // Grant the necessary permissions to EventBridge to send messages to the SQS queue
          notificationQueue.addToResourcePolicy(
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              principals: [new iam.ServicePrincipal("events.amazonaws.com")],
              actions: ["sqs:SendMessage"],
              resources: [notificationQueue.queueArn],
            })
          );
        } else {
          this.bucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3Notifications.SqsDestination(notificationQueue)
          );

          this.bucket.addEventNotification(
            s3.EventType.OBJECT_REMOVED,
            new s3Notifications.SqsDestination(notificationQueue)
          );
        }
      }
    }
  }
}
