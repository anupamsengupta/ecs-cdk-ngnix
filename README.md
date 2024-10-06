# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Force delete stack if stuck
aws cloudformation continue-update-rollback --stack-name ecsCdkSBAppDirectStackSimple --resources-to-skip <sbapp2Service81A9EB4A>
aws cloudformation update-termination-protection --stack-name ecsCdkSBAppDirectStackSimple --no-enable-termination-protection
aws cloudformation delete-stack --stack-name ecsCdkSBAppDirectStackSimple
