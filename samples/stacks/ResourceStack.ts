import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { QSNetworkStack } from "../../lib/qs-network-stack";
import { QSClusterMain } from "../../lib/qs-ecs-cluster";
import { QSS3BucketConstruct } from "../../lib/qs-s3";
import { QSSqsQueueConstruct } from "../../lib/qs-sqs";
import { QSSnsTopicConstruct } from "../../lib/qs-sns";

export interface ResourceStackProps extends cdk.StackProps {
    stackName: string;
    clusterConstruct: QSClusterMain;
    clusterNetworkStack: QSNetworkStack;
}

export class ResourceStack extends cdk.Stack {

    constructor(scope: Construct, id: string, resourceProps: ResourceStackProps) {
        super(scope, id, resourceProps);
        //Add a queue
        const testQueue = new QSSqsQueueConstruct(
            this,
            resourceProps.stackName + "com-quickysoft-anu-testqueue-13102024",
            {
                stackName: resourceProps.stackName,
                queueName: "com-quickysoft-anu-testqueue-13102024",
                deadLetterQueueName: "com-quickysoft-anu-testqueue-13102024-dlq",
            }
        );

        //Add a sns topic
        const snsQueueConstruct = new QSSnsTopicConstruct(
            this,
            "com-quickysoft-anu-test-14102024",
            {
                stackName: resourceProps.stackName,
                topicName: "com-quickysoft-anu-test-14102024",
            }
        );

        //Add a bucket with a event notification to a queue
        const testS3BucketEN = new QSS3BucketConstruct(
            this,
            this.stackName + "com-quickysoft-anu-eventnotification",
            {
                stackName: resourceProps.stackName,
                bucketName: "com-quickysoft-anu-eventnotification-bucket",
                eventNotificationEnabled: true,
                notificationQueueName: "com-quickysoft-anu-eventnotification-q",
            }
        );
        //Add a bucket with a event bridge enabled to a queue
        const testS3BucketEB = new QSS3BucketConstruct(
            this,
            this.stackName + "com-quickysoft-anu-eventbridge",
            {
                stackName: resourceProps.stackName,
                bucketName: "com-quickysoft-anu-eventbridge-bucket",
                eventBridgeEnabled: true,
                notificationQueueName: "com-quickysoft-anu-eventbridge-q",
            }
        );
    }
}
