#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
//import { EcsCdkSpringBootAppStackVPCLinkAndNLB } from '../lib/ecs-cdk-sbapp-stack-vpc-link-nlb';
//import { EcsCdkSpringBootAppStackLambdaAndALB } from '../lib/ecs-cdk-sbapp-stack-simple-alb-apigateway-lambda';
import { EcsCdkSBAppDirectStackSimple } from '../lib/ecs-cdk-sbapp-stack-direct-alb-apigateway-lambda';

const app = new cdk.App();
new EcsCdkSBAppDirectStackSimple(app, 'ecsCdkSBAppDirectStackSimple', {
  env : {region : 'us-east-1'}
});
app.synth();