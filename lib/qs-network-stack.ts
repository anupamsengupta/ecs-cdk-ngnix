import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { IQSNetwork, QSNetworkMain } from "./qs-network"

export interface QSNetworkStackProps extends StackProps {
    vpcCidr: string;
    azs: string[];
}

export class QSNetworkStack extends Stack {
    network: IQSNetwork;

    constructor(scope: Construct, id: string, props: QSNetworkStackProps) {
        super(scope, id, props);

        this.network = new QSNetworkMain(this, "Network", {
            stackName: id,
            vpcCidr: ec2.IpAddresses.cidr(props.vpcCidr),
            azs: props.azs
        });

    }
}


