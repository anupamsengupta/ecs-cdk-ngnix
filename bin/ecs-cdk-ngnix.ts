#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
//import { EcsCdkSpringBootAppStackVPCLinkAndNLB } from '../lib/ecs-cdk-sbapp-stack-vpc-link-nlb';
//import { EcsCdkSpringBootAppStackLambdaAndALB } from '../lib/ecs-cdk-sbapp-stack-simple-alb-apigateway-lambda';
//import { EcsCdkSBAppDirectStackSimple } from '../lib/ecs-cdk-sbapp-stack-direct-alb-apigateway-lambda-2';
//import {EcsCdkSimpleApiNlbEcsDemoStack} from '../lib/simple-api-nlb-ecs';
//import {EcsCdkSimpleApiNlbAlbEcsDemoStack} from '../lib/simple-api-nlb-alb-ecs';
import {EcsCdkSimpleApiNlbAlbEcsModularDemoStack} from '../lib/simple-api-nlb-alb-ecs-modular';

const app = new cdk.App();
new EcsCdkSimpleApiNlbAlbEcsModularDemoStack(app, 'ecsCdkSimpleApiNlbAlbEcsModularDemoStack', {
  env : {region : 'us-east-1'}
});
app.synth();