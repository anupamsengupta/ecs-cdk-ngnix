#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
//import { EcsCdkSpringBootAppStackVPCLinkAndNLB } from '../samples/samples-ecs-cdk-sbapp-stack-vpc-link-nlb';
//import { EcsCdkSpringBootAppStackLambdaAndALB } from '../samples/samples-ecs-cdk-sbapp-stack-simple-alb-apigateway-lambda';
//import { EcsCdkSBAppDirectStackSimple } from '../samples/samples-ecs-cdk-sbapp-stack-direct-alb-apigateway-lambda-2';
//import {EcsCdkSimpleApiNlbEcsDemoStack} from '../samples/samples-simple-api-nlb-ecs';
//import {EcsCdkSimpleApiNlbAlbEcsDemoStack} from '../samples/samples-simple-api-nlb-alb-ecs';
//import { EcsCdkSimpleApiNlbAlbEcsModularDemoStack } from "../samples/samples-simple-api-nlb-alb-ecs-modular-inline";
import { EcsCdkSimpleApiNlbAlbEcsModularDemoStack } from "../samples/samples-simple-api-nlb-alb-ecs-modular-uncommented";
//import { EcsCdkSimpleApiNlbAlbEcsModularStackwiseParent } from "../samples/samples-simple-api-nlb-alb-ecs-modular-stackwise";
//import { S3ToSqsNotification } from "../samples/s3-to-sqs-notification";
//import { S3ToSqsNotificationWithConstruct } from "../samples/s3-to-sqs-notification with-construct";
const app = new cdk.App();
new EcsCdkSimpleApiNlbAlbEcsModularDemoStack(
  app,
  "sample",
  {
    env: { region: "us-east-1" },
  }
);
app.synth();
