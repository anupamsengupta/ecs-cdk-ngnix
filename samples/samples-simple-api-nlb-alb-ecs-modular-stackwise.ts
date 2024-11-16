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
        const clusterConstruct = new QSClusterMain(this, "sb-app-cluster", {
            serviceClusterName: "svcCluster",
            network: clusterNetworkStack.network,
            stackName: "sbApp",
            serviceDiscoveryNamespace: namespace,
        });

        const resourceStack = new ResourceStack(this, "ResourceStack", {
            env: {
                region: this.region,
            },
            clusterNetworkStack: clusterNetworkStack,
            clusterConstruct: clusterConstruct,
            stackName: "ResourceStack",
        });

        const apiStack = new APIStack(this, "APIStack", {
            env: {
                region: this.region,
            },
            clusterConstruct: clusterConstruct,
            clusterNetworkStack: clusterNetworkStack,
            stackName: "APIStack",
            backendService: "backend",
            frontend1Service: "frontend1",
            frontend2Service: "frontend2",
        });

        const backendTaskStk = new BackendStack(this, "backend", {
            env: {
                region: this.region,
            },
            clusterConstruct: clusterConstruct,
            clusterNetworkStack: clusterNetworkStack,
            contextPath: "backend",
            stackName: "backend",
        });

        const frontendTaskStk1 = new FrontendStack(this, "frontend1", {
            env: {
                region: this.region,
            },
            clusterConstruct: clusterConstruct,
            clusterNetworkStack: clusterNetworkStack,
            contextPath: "frontend1",
            stackName: "frontend1",
        });

        const frontendTaskStk2 = new FrontendStack(this, "frontend2", {
            env: {
                region: this.region,
            },
            clusterConstruct: clusterConstruct,
            clusterNetworkStack: clusterNetworkStack,
            contextPath: "frontend2",
            stackName: "frontend2",
        });

    }
}