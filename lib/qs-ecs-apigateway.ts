import { Construct } from "constructs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export interface QSApiGatewayProps {
  stackName: string;
  apiName: string;
  appNlb: elbv2.NetworkLoadBalancer;
  integrationHttpMethod: string;
  apiKeyRequired?: boolean;
  vpcLink: apigateway.VpcLink;
}

export interface IQSApiGateway {
  readonly restapi: apigateway.RestApi;
  readonly apiDelegationIntegration: apigateway.Integration;
}

export class QSApiGatewayMain extends Construct implements IQSApiGateway {
  public readonly restapi: apigateway.RestApi;
  public readonly apiDelegationIntegration: apigateway.Integration;

  public constructor(scope: Construct, id: string, props: QSApiGatewayProps) {
    super(scope, id);

    if (props.apiKeyRequired == undefined) {
      props.apiKeyRequired = false;
    }
    console.log(
      "props.appNlb.loadBalancerFullName - " +
        props.appNlb.loadBalancerFullName
    );

    // Create GET methods with VPC Link integration for each resource
    const localApiDelegationIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: props.integrationHttpMethod,
      // The URI always needs to be mentioned in back quotes as below
      // Single quote doesnt work.
      uri: `http://${props.appNlb.loadBalancerDnsName}/{proxy}`,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink: props.vpcLink,
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy", // Pass the path to NLB
        },
      },
    });
    this.apiDelegationIntegration = localApiDelegationIntegration;

    // Create an API Gateway
    const localRestApi = new apigateway.RestApi(
      this,
      props.stackName + "ApiGateway",
      {
        restApiName: props.stackName + "ApiGateway",
        description:
          "API Gateway to access the app " +
          props.stackName +
          " service running on ECS Fargate",
      }
    );
    this.restapi = localRestApi;
    console.log("props.vpcLink.vpcLinkId - " + props.vpcLink.vpcLinkId);

    const items = localRestApi.root.addResource("{proxy+}");
    const rootMethod = items.addMethod("ANY", localApiDelegationIntegration, {
      requestParameters: {
        "method.request.path.proxy": true, // Enable path proxying
      },
      apiKeyRequired: props.apiKeyRequired,
    });

    if (props.apiKeyRequired) {
      const apiKey = localRestApi.addApiKey(
        props.stackName + props.apiName + "APIKey",
        {
          apiKeyName: props.stackName + props.apiName + "APIKey",
        }
      );

      //Usage plan and API Key
      const usagePlan = localRestApi.addUsagePlan(
        props.stackName + props.apiName + "UsagePlan",
        {
          name: props.stackName + props.apiName + "UsagePlan",
          throttle: {
            rateLimit: 5,
            burstLimit: 10,
          },
          quota: {
            limit: 120,
            period: apigateway.Period.WEEK,
          },
        }
      );
      usagePlan.addApiKey(apiKey);

      usagePlan.addApiStage({
        stage: localRestApi.deploymentStage,
        throttle: [
          {
            method: rootMethod, // Apply throttle to the 'GET' method on 'items'
            throttle: {
              rateLimit: 5, // 5 requests per second for this method
              burstLimit: 10,
            },
          },
        ],
      });
    }
  }

  /*public addParentLevelResource(
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
  }*/
}
