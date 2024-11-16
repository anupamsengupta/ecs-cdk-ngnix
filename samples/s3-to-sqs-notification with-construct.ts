import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { QSSqsQueueConstruct } from "../lib/qs-sqs";
import { QSS3BucketConstruct } from "../lib/qs-s3";

export class S3ToSqsNotificationWithConstruct extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dlqName = "com-quickysoft-anu-s3-nfn-DLQ";
    const qName = "com-quickysoft-anu-s3-nfn";
    //Add a queue
    const mainQueueConstruct = new QSSqsQueueConstruct(
      this,
      this.stackName + qName,
      {
        stackName: this.stackName,
        queueName: qName,
        deadLetterQueueName: dlqName,
      }
    );
    // Create an S3 bucket
    const bucketName = "com-quickysoft-anu-s3-events-bucket";
    //Add a bucket with a event nfn to a queue
    const testS3BucketEN = new QSS3BucketConstruct(
      this,
      this.stackName + bucketName,
      {
        stackName: this.stackName,
        bucketName: bucketName,
        //eventNotificationEnabled: true,
        eventBridgeEnabled: true,
        targetNotificationQueue: mainQueueConstruct.q,
        versioned: true,
      }
    );
  }
}
