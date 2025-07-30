This project enables protecting web applications hosted on AWS S3 by ensuring secure cookies in place by a  `viewer request`
https://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html 

Upon receiving a `viewer request` CloudFront will invoke the behavior to trigger this lambda function.
1. If there are no secure cookies, and no JWT token, this service serves up static HTML (aadRedirect.html) to facilitate the Azure Active Directory authentication.
2. The service checks if a JWT token was provided. (If yes, this function uses KeyGroups from Secrets Manager to create signed cookies)
3. The service checks for secure cookies.  (If yes, this function takes no action.\)

![sequence diagram of rebarEdge](docs/edge.png "Sequence Diagram")



## Getting Started
### Pre-requisites
* This project will be cloned into your application when running the Cloud SPA 2.0 Cartridge

   * git
   * nodejs (latest LTS is preferred)

* Ensure access to the AWS Console to deploy new AWS Lambda (access to AWS Console is outside the scope of this document).  This lambda function requires an execution role. 


The Cartridge will have copied  `env.sample.json` to `env.sandbox.json`, `env.dev.json`, `env.stg.json`, and `env.prod.json` and set the variables for the application and environments.


> All four `sandbox, dev, stg and prod env.json` files bind the redirect url to the Azure AD tenant (DS/non-prod or DIR/prod).  You _will need an instance of this function_ for **each** coupling of URL to AzureAD configuration
```
{
    "APPLICATION": "{APP_NAME}",
    "AUTHORITY": "replace with your Tenant ID (DS or DIR). For more info on Tenant ID visit this site https://in.accenture.com/enterprisesignonintegration/azure-integrations/azure-ad-integration-native-apps/",
    "CLIENT_ID": "replace with your Azure AD Application (client) ID. Login to https://portal.azure.com/ -> Select azure AD -> select App registration -> click All applications -> look for your application and copy the Application ID ",
    "DOMAIN": " replace with your front-end application URL domain (without https or trailing slash). E.g. myapp.ciostage.accenture.com",
    "SECRETS_MANAGER_CLOUDFRONT_KEY": "{CLOUDFRONT_KEY}",
    "REGION": "{region}"
}
```
For `"SECRETS_MANAGER_CLOUDFRONT_KEY"`, `"REGION"` and `"APPLICATION"` the values are automatically generated. Therefore, no changes are needed. 

## Prepare to deploy
#### Deploy using Azure Devops

The project comes with a starter `azure-pipelines-ci.yml` and ``azure-pipelines-cd.yml``
#### Building (and deploying) Locally

* Run the install `npm install`
* From the command line run `npm run build` to create your AWS Lambda function.  

The name of the zip file will be set according to the repo name in `package.json` 

## Deploy ESO-Shim to AWS2.0
Please refer to this [link](https://ciodeveloper.accenture.com/cio_cartridge/cloud2_cartridge/aws2/common/spa2.0_deployment/#1-run-cicd-for-eso-shim) for instructions on how to deploy eso-shim using AWS2.0

