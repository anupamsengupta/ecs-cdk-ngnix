import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as iam from "aws-cdk-lib/aws-iam";

export class S3ToSqsNotification extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a DLQ (dead-letter queue)
    const dlqName = "com-quickysoft-anu-s3-notification-DLQ";
    const deadLetterQueue = new sqs.Queue(this, dlqName, {
      queueName: dlqName,
      retentionPeriod: cdk.Duration.days(2),
    });

    // Create the main SQS queue with DLQ attached
    const qName = "com-quickysoft-anu-s3-notification";
    const mainQueue = new sqs.Queue(this, qName, {
      queueName: qName,
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 1, // Messages will be sent to DLQ after 5 failed processing attempts
      },
    });

    // Create an S3 bucket
    const bucket = new s3.Bucket(this, "Bucket", {
      bucketName: "com-quickysoft-anu-s3-events-bucket",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Use REMOVE policy only for testing; consider RETAIN for production
    });

    // Grant S3 permission to send messages to SQS by adding permissions to the S3 bucket's policy

    // Grant the necessary permissions to EventBridge to send messages to the SQS queue
    mainQueue.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("events.amazonaws.com")],
        actions: ["sqs:SendMessage"],
        resources: [mainQueue.queueArn],
      })
    );

    // Set up the event notification for the S3 bucket
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SqsDestination(mainQueue)
    );
  }
}
