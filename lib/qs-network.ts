import { Construct } from "constructs";
import { Tags } from 'aws-cdk-lib';
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface QSNetworkProps {
    stackName: string;
    vpcCidr: ec2.IIpAddresses;
    azs: string[];
}

export interface IQSNetwork {
    readonly vpc: ec2.IVpc;

    /**
     * Security group to be used by RDS databases and tools that need to work with them
     */
    preconfiguredSecurityGroup: ec2.ISecurityGroup;
    publicInfraSubnets(): ec2.ISubnet[];
    privateInfraSubnets(): ec2.ISubnet[];
}

abstract class QSNetworkBase extends Construct implements IQSNetwork {

    private readonly stackName: string;

    public abstract readonly vpc: ec2.IVpc;
    public abstract readonly preconfiguredSecurityGroup: ec2.ISecurityGroup;

    public constructor(scope: Construct, id: string, stackName: string) {
        super(scope, id);
        this.stackName = stackName;
    }

    protected publicInfraSubnetGroupName(): string {
        return `${this.stackName}-InfraPublic`;
    }

    protected privateInfraSubnetGroupName(): string {
        return `${this.stackName}-InfraPrivate`;
    }

    public publicInfraSubnets(): ec2.ISubnet[] {
        return this.vpc.selectSubnets({
            subnetGroupName: this.publicInfraSubnetGroupName()
        }).subnets;
    }

    public privateInfraSubnets(): ec2.ISubnet[] {
        return this.vpc.selectSubnets({
            subnetGroupName: this.privateInfraSubnetGroupName()
        }).subnets;
    }

}

export class QSNetworkMain extends QSNetworkBase {

    public readonly vpc: ec2.IVpc;
    public readonly preconfiguredSecurityGroup: ec2.ISecurityGroup;

    public constructor(scope: Construct, id: string, props: QSNetworkProps) {
        super(scope, id, props.stackName);

        this.vpc = new ec2.Vpc(this, `${props.stackName}-VPC`, {
            vpcName: `${props.stackName}-VPC`,
            ipAddresses: props.vpcCidr,
            availabilityZones: props.azs,
            restrictDefaultSecurityGroup: true,
            subnetConfiguration: [
                {
                    cidrMask: 21,
                    name: this.publicInfraSubnetGroupName(),
                    subnetType: ec2.SubnetType.PUBLIC
                },
                {
                    cidrMask: 20,
                    name: this.privateInfraSubnetGroupName(),
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
                }
            ],
            natGatewaySubnets: {
                subnetGroupName: this.publicInfraSubnetGroupName()
            },
            gatewayEndpoints: {
                "s3": {
                    service: ec2.GatewayVpcEndpointAwsService.S3
                },
                "dynamoDB": {
                    service: ec2.GatewayVpcEndpointAwsService.DYNAMODB
                }
            }
        });
        this.preconfiguredSecurityGroup = new ec2.SecurityGroup(this, `${props.stackName}-Default-SG`, {
            vpc: this.vpc,
            securityGroupName: `${props.stackName}-Default-SG`,
            allowAllOutbound: false,
            description: "Default SG for all "
        });

        this.privateInfraSubnets().forEach(subnet => {
            Tags.of(subnet).add("ecsNetworkCluster/subnet-usage", "infrastructure");
        });
        this.publicInfraSubnets().forEach(subnet => {
            Tags.of(subnet).add("ecsNetworkCluster/subnet-usage", "infrastructure");
        });
    }

    public static fromVpcId(scope: Construct, id: string, stackName: string, vpcId: string): IQSNetwork {
        return new LookedUpNetwork(scope, id, stackName, vpcId);
    }
}

class LookedUpNetwork extends QSNetworkBase {

    public readonly vpc: ec2.IVpc;
    public readonly preconfiguredSecurityGroup: ec2.ISecurityGroup;

    constructor(scope: Construct, id: string, stackName: string, vpcId: string) {
        super(scope, id, stackName);

        this.vpc = ec2.Vpc.fromLookup(this, `${stackName}-VPC`, {
            vpcId: vpcId
        });
        this.preconfiguredSecurityGroup = ec2.SecurityGroup.fromLookupByName(this, `${stackName}-Default-SG`,
            `${stackName}-Default-SG`, this.vpc);
    }
}
