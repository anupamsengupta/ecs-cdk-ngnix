#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
//import { EcsCdkSpringBootAppStackVPCLinkAndNLB } from '../samples/samples-ecs-cdk-sbapp-stack-vpc-link-nlb';
//import { EcsCdkSpringBootAppStackLambdaAndALB } from '../samples/samples-ecs-cdk-sbapp-stack-simple-alb-apigateway-lambda';
//import { EcsCdkSBAppDirectStackSimple } from '../samples/samples-ecs-cdk-sbapp-stack-direct-alb-apigateway-lambda-2';
//import {EcsCdkSimpleApiNlbEcsDemoStack} from '../samples/samples-simple-api-nlb-ecs';
//import {EcsCdkSimpleApiNlbAlbEcsDemoStack} from '../samples/samples-simple-api-nlb-alb-ecs';
import { EcsCdkSimpleApiNlbAlbEcsModularDemoStack } from "../samples/samples-simple-api-nlb-alb-ecs-modular";

const app = new cdk.App();
new EcsCdkSimpleApiNlbAlbEcsModularDemoStack(
  app,
  "api-nlb-alb-modular-demo-stack0",
  {
    env: { region: "us-east-1" },
  }
);
app.synth();
