import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface QSRdsPostgresProps {
  //required attributes
  stackName : string;
  vpc : ec2.IVpc;
  databaseName : string;
  securityGroup : ec2.ISecurityGroup;

  //optional attributes with dev reasonable defaults
  postgresEngineVersion ? : rds.PostgresEngineVersion;
  instanceClass ? : ec2.InstanceClass;
  instanceSize ? : ec2.InstanceSize;
  subnetType ? : ec2.SubnetType;
  multiAz ? : boolean;
  adminUser ? : string;
  adminPassword ? : string;

  //optional attributes with dev reasonable defaults
  allocatedStorage ? : number;
  storageType ? : rds.StorageType;
  publiclyAccessible ? : boolean;
  deletionProtection ? : boolean;
  backupRetention ? : cdk.Duration;
  removalPolicy ? : cdk.RemovalPolicy;
}

export interface IQSRdsPostgres {
  readonly iDb: rds.IDatabaseInstance;
}

export class QSRdsPostgresConstruct extends Construct implements IQSRdsPostgres {
  public readonly iDb: rds.IDatabaseInstance;

  public constructor(scope: Construct, id: string, props: QSRdsPostgresProps) {
    super(scope, id);
    if (props.postgresEngineVersion == undefined) {
      props.postgresEngineVersion = rds.PostgresEngineVersion.VER_16_4;
    }
    if (props.instanceClass == undefined) {
      props.instanceClass = ec2.InstanceClass.BURSTABLE3;
    }
    if (props.instanceSize == undefined) {
      props.instanceSize = ec2.InstanceSize.MICRO;
    }
    if (props.subnetType == undefined) {
      props.subnetType = ec2.SubnetType.PRIVATE_WITH_EGRESS;
    }
    if (props.multiAz == undefined) {
      props.multiAz = false;
    }
    if (props.adminUser == undefined) {
      props.adminUser = 'postgress';
    }
    if (props.adminPassword == undefined) {
      props.adminPassword = 'password12345';
    }

    if (props.allocatedStorage == undefined) {
      props.allocatedStorage = 20;
    }
    if (props.storageType == undefined) {
      props.storageType = rds.StorageType.GP2;
    }
    if (props.publiclyAccessible == undefined) {
      props.publiclyAccessible = false;
    }
    if (props.deletionProtection == undefined) {
      props.deletionProtection = false;
    }
    if (props.backupRetention == undefined) {
      props.backupRetention = cdk.Duration.days(7);
    }
    if (props.removalPolicy == undefined) {
      props.removalPolicy = cdk.RemovalPolicy.DESTROY;
    }

    // Create a secret to store the RDS database credentials
    const dbCredentialsSecret = new secretsmanager.Secret(this, props.stackName + props.databaseName + 'DBSecret', {
      secretName: props.stackName + "-" + props.databaseName + '-DBSecret',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username : props.adminUser,
          password : props.adminPassword,
        }), // PostgreSQL default username
        generateStringKey : props.adminPassword,
        excludeCharacters: '"@/\\', // Avoid characters that might cause issues in connection strings
      },
    });

    // Create the RDS PostgreSQL instance inside the private subnets
    const rdsInstance = new rds.DatabaseInstance(this, props.databaseName, {
      databaseName : props.databaseName,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: props.postgresEngineVersion, // Specify PostgreSQL version
      }),
      instanceType: ec2.InstanceType.of(props.instanceClass, props.instanceSize), // Cost-efficient instance type
      vpc : props.vpc,
      vpcSubnets: {
        subnetType: props.subnetType, // Ensure RDS is placed in private subnets
      },
      securityGroups: [props.securityGroup],
      credentials: rds.Credentials.fromSecret(dbCredentialsSecret), // Use Secrets Manager for credentials
      multiAz: props.multiAz, // Set true for high availability in multiple AZs
      allocatedStorage: props.allocatedStorage, // Minimum storage size in GB
      storageType: props.storageType, // General Purpose SSD
      publiclyAccessible: props.publiclyAccessible, // Ensure RDS is not publicly accessible
      deletionProtection: props.deletionProtection, // For dev/test environments, this can be set to false
      backupRetention: props.backupRetention, // Retain backups for 7 days
      removalPolicy: props.removalPolicy, // Optional: Automatically delete the database when stack is destroyed (use RETAIN for production)
    });
    this.iDb = rdsInstance;

    // Output the RDS endpoint and secret ARN
    new cdk.CfnOutput(this, 'RDSInstanceEndpoint', {
      value: rdsInstance.dbInstanceEndpointAddress,
      description: 'RDS Endpoint Address',
    });

    new cdk.CfnOutput(this, 'RDSInstanceSecretArn', {
      value: dbCredentialsSecret.secretArn,
      description: 'Secret ARN for DB credentials',
    });
  }
}
