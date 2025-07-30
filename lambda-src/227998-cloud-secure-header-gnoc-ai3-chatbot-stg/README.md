# Introduction 
The Secure-Header code implementation adds the lambda that triggers for origin-response in cloudfront for the web application. It's a group of six headers which addresses six different security concerns.

The following six response headers are included by the standard, and applications must minimally meet five of six to score well when externally scanned.

* Strict-Transport-Security
* X-Content-Type-Options
* Cache-control
* X-Xss-Protection
* Content-Security-Policy
* X-Frame-Options

# Getting Started
## Pre-Requisites
* This project will be cloned into your application when running the Cloud SPA 2.0 Cartridge.
* Install dependencies
   * git
   * nodejs (latest LTS is preferred)
* You must have access to an AWS Lambda Execution Role which includes the edgelambda.amazonaws.com principal.  Normally, your Cloud Delivery Manager would confirm that your login user, role and AWS account have this additional principal configured for the existing lambda_basic_execution role.

* You will get `env.json` file with your application name.

## Prepare to deploy
#### Deploy using Azure Devops
The project comes with a starter `azure-pipelines-ci.yml` and `azure-pipelines-cd.yml`. 

#### Building (and deploying) Locally
* Run the install command `npm install`
* Then from the command line run `npm run build` to create your AWS Lambda function.  

The name of the zip file will be set according to the repo name in `package.json`.

## Deploy Secure-Header to AWS2.0
Run the Secure-Header CI pipeline. After the CI is done, execute the CD pipeline.
For help, please refer [here](https://ciodeveloper.accenture.com/cio_cartridge/cloud2_cartridge/aws2/common/spa2.0_deployment/#deployment).
