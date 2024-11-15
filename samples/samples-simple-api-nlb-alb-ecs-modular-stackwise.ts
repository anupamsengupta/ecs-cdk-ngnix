import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { QSNetworkStack } from "../lib/qs-network-stack";
import { QSClusterMain } from "../lib/qs-ecs-cluster";
import { FrontendStack } from "./stacks/frontendstack";
import { BackendStack } from "./stacks/backendstack";
import { APIStack } from "./stacks/APIStack";
import { ResourceStack } from "./stacks/ResourceStack";

export class EcsCdkSimpleApiNlbAlbEcsModularStackwiseParent extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Apply tags to the entire stack
        cdk.Tags.of(this).add("Environment", "Rnd");
        cdk.Tags.of(this).add("billing-code", "ICRQ-1843");

        // Create a VPC and overall network
        const clusterNetworkStack = new QSNetworkStack(
            scope,
            "ecsNetworkStackName2",
            {
                env: {
                    region: this.region,
                },
                vpcCidr: "10.101.0.0/16",
                azs: ["us-east-1a", "us-east-1b"],
            }
        );

        const vpc: ec2.IVpc = clusterNetworkStack.network.vpc;
        let namespace = "sb-app-shared-namespace";
        //Create the cluster, roles and namespaces
        const clusterConstruct = new QSClusterMain(this, "sb-app-cluster2", {
            serviceClusterName: "svcCluster2",
            network: clusterNetworkStack.network,
            stackName: "sbApp2",
            serviceDiscoveryNamespace: namespace,
        });

        const resourceStack = new ResourceStack(scope, "ResourceStack2", {
            env: {
                region: this.region,
            },
            clusterNetworkStack: clusterNetworkStack,
            clusterConstruct: clusterConstruct,
            stackName: "ResourceStack",
        });

        const backendTaskStk = new BackendStack(scope, "backendStack2", {
            env: {
                region: this.region,
            },
            clusterConstruct: clusterConstruct,
            clusterNetworkStack: clusterNetworkStack,
            contextPath: "backend",
            stackName: "backend",
        });

        const frontendTaskStk1 = new FrontendStack(scope, "frontend1Stack2", {
            env: {
                region: this.region,
            },
            clusterConstruct: clusterConstruct,
            clusterNetworkStack: clusterNetworkStack,
            contextPath: "frontend1",
            stackName: "frontend1",
        });

        const frontendTaskStk2 = new FrontendStack(scope, "frontend2Stack2", {
            env: {
                region: this.region,
            },
            clusterConstruct: clusterConstruct,
            clusterNetworkStack: clusterNetworkStack,
            contextPath: "frontend2",
            stackName: "frontend2",
        });

        const apiStack = new APIStack(scope, "APIStack2", {
            env: {
                region: this.region,
            },
            clusterConstruct: clusterConstruct,
            clusterNetworkStack: clusterNetworkStack,
            stackName: "APIStack2",
            backendService: "backend",
            frontend1Service: "frontend1",
            frontend2Service: "frontend2",
            //backendStack: backendTaskStk,
            //frontendStack1: frontendTaskStk1,
            //frontendStack2: frontendTaskStk2,
        });

    }
}