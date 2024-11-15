import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { QSNetworkStack } from "../../lib/qs-network-stack";
import { QSClusterMain } from "../../lib/qs-ecs-cluster";
import {
    IQSAppLoadBalancer,
    QSAppLoadBalancerMain,
} from "../../lib/qs-ecs-apploadbalancer";
import {
    IQSNetworkLoadBalancer,
    QSNetworkLoadBalancerMain,
} from "../../lib/qs-ecs-networkloadbalancer";
import { QSApiGatewayMain } from "../../lib/qs-ecs-apigateway";
import { BackendStack } from "./backendstack";
import { FrontendStack } from "./frontendstack";

export interface APIStackProps extends cdk.StackProps {
    stackName: string;
    clusterConstruct: QSClusterMain;
    clusterNetworkStack: QSNetworkStack;

    backendService: string;
    frontend1Service: string;
    frontend2Service: string;
}

export class APIStack extends cdk.Stack {

    constructor(scope: Construct, id: string, apiProps: APIStackProps) {
        super(scope, id, apiProps);

        const vpc: ec2.IVpc = apiProps.clusterNetworkStack.network.vpc;
        const ecsSecurityGroup = apiProps.clusterNetworkStack.network.preconfiguredVpcCidrAccessHttpSecurityGroup;

        const appLoadBalancerConstruct: IQSAppLoadBalancer =
            new QSAppLoadBalancerMain(this, apiProps.stackName + "ALBConstruct", {
                stackName: apiProps.stackName,
                vpc: vpc,
                internetFacing: false,
                port: 80,
                open: true,
                securityGroup: ecsSecurityGroup,
            });

        appLoadBalancerConstruct.addListenerTargetBasedOnPath(
            apiProps.backendService,
            80,
        );
        appLoadBalancerConstruct.addListenerTargetBasedOnPath(
            apiProps.frontend1Service,
            80,
        );
        appLoadBalancerConstruct.addListenerTargetBasedOnPath(
            apiProps.frontend2Service,
            80,
        );

        //Apply autoscaling properties.
        /*apiProps.backendStack.backendTask.applyAutoscaling(backendTarget);
        apiProps.frontendStack1.frontendTask.applyAutoscaling(frontend1Target);
        frontendTask2.applyAutoscaling(frontend2Target);*/

        const nlbConstruct: IQSNetworkLoadBalancer = new QSNetworkLoadBalancerMain(
            this,
            this.stackName + "NLBConstruct",
            {
                stackName: this.stackName,
                vpc: vpc,
                internetFacing: true,
                port: 80,
                open: true,
                applicationListener: appLoadBalancerConstruct.applicationListener,
            }
        );

        const apiName = "FrontEndSpringBootAppServiceApi";
        // Create a VPC Link for API Gateway
        const vpcLink = new apigateway.VpcLink(this, "VpcLink", {
            vpcLinkName: this.stackName + "vpclink",
            targets: [nlbConstruct.appNlb],
        });

        //API Gateway construct added
        const apiCostruct = new QSApiGatewayMain(this, "Test API Gateway Construct", {
            apiName: apiName,
            appNlb: nlbConstruct.appNlb,
            stackName: this.stackName,
            integrationHttpMethod: "ANY",
            apiKeyRequired: true,
            vpcLink: vpcLink,
        });

        new cdk.CfnOutput(this, "LoadBalancerDNS", {
            value: nlbConstruct.appNlb.loadBalancerDnsName,
        });
    }
}