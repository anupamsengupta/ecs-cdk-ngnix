#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EcsCdkNgnixStackVPCLinkAndNLB } from '../lib/ecs-cdk-ngnix-stack-vpc-link-nlb';

const app = new cdk.App();
new EcsCdkNgnixStackVPCLinkAndNLB(app, 'EcsCdkNgnixStackVPCLinkAndNLB', {
  env : {region : 'us-east-1'}
});
app.synth();