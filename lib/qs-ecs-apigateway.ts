import { Construct } from "constructs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export interface QSApiGatewayProps {
  stackName: string;
  appNlb: elbv2.NetworkLoadBalancer
  integrationHttpMethod: string;
}

export interface IQSApiGateway {
  readonly restapi : apigateway.RestApi;
  readonly apiDelegationIntegration: apigateway.Integration;
  readonly vpcLink: apigateway.VpcLink;

  addParentLevelResource(
    resourceName: string,
  ) : apigateway.Resource;
}

export class QSApiGatewayMain
  extends Construct implements IQSApiGateway
{
  public readonly restapi : apigateway.RestApi;
  public readonly apiDelegationIntegration: apigateway.Integration;
  public readonly vpcLink: apigateway.VpcLink;

  public constructor(scope: Construct, id: string, props: QSApiGatewayProps) {
    super(scope, id);

    console.log('this.vpcLink.props.appNlb.loadBalancerFullName - ' + props.appNlb.loadBalancerFullName)
    // Create a VPC Link for API Gateway
    const vpcLink1 = new apigateway.VpcLink(this, props.appNlb.loadBalancerName + 'VpcLink', {
      targets: [props.appNlb],
    });
    this.vpcLink = vpcLink1;

    // Create GET methods with VPC Link integration for each resource
    const apiDelegationIntegration1 = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: props.integrationHttpMethod,
      uri: `http://${props.appNlb.loadBalancerDnsName}/{proxy}`,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink: this.vpcLink,
      },
    });
    this.apiDelegationIntegration = apiDelegationIntegration1;

    // Create an API Gateway
    const restapi1 = new apigateway.RestApi(this, props.stackName + 'ApiGateway', {
      restApiName: props.stackName + 'ApiGateway',
      description: 'API Gateway to access the app ' + props.stackName + ' service running on ECS Fargate',
    });
    this.restapi = restapi1;
    console.log('this.vpcLink.vpcLinkId - ' + this.vpcLink.vpcLinkId)

  }

  public addParentLevelResource(
    resourceName: string,
  ) : apigateway.Resource {
    // Create REST resources
    const mainResource = this.restapi.root.addResource(resourceName);
    console.log('this.vpcLink.vpcLinkId - ' + this.vpcLink.vpcLinkId)
    mainResource
      .addResource("{proxy+}")
      .addMethod("ANY", this.apiDelegationIntegration, {
        requestParameters: {
          "method.request.path.proxy": true, // Enable path proxying
        },
      });
    
    return mainResource;
  }
}
