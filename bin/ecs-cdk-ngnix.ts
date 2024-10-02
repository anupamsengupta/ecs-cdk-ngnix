#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EcsCdkNgnixStackVPCLinkAndNLB } from '../lib/ecs-cdk-ngnix-stack-vpc-link-nlb';
//import { EcsCdkNgnixStackSimple } from '../lib/ecs-cdk-ngnix-stack-simple-alb-apigateway-lambda';

const app = new cdk.App();
new EcsCdkNgnixStackVPCLinkAndNLB(app, 'EcsCdkNgnixStackVPCLinkAndNLB', {
  env : {region : 'us-east-1'}
});
app.synth();