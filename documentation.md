
# Project Documentation

This document provides a detailed overview of the backend, infrastructure, and CI/CD pipeline for the GNOC Chatbot AI project.

## 1. Backend

The backend is composed of a set of AWS Lambda functions, each responsible for a specific piece of functionality.

### 1.1. Lambda Functions

- **`227998-cloud-eso-shim-gnoc-ai3-chatbot-stg`**: This function is a Lambda@Edge function that intercepts `viewer request` events from CloudFront. It checks for secure cookies and JWT tokens to protect the web application hosted on S3. If no authentication is present, it redirects the user to an Azure AD authentication page.

- **`227998-cloud-secure-header-gnoc-ai3-chatbot-stg`**: This function is a Lambda@Edge function that triggers on `origin-response` events from CloudFront. It adds a set of security headers to the response to enhance the security of the web application.

- **`gnoc-ata-integaration`**: This function serves as the primary API for the Amethyst studio agent. It provides the following functionalities:
    - `GetIncidentById`: Retrieves an incidents from DynamoDB by its ID.
    - `GetIncidentsByDate`: Retrieves incidents from DynamoDB within a specified date range with optional filtering based on category, priority, and source.
    - `GetIncidentByProblemRecord`: Retrieves an incidents from DynamoDB by its problem record numbers.
    - `GetMonthlyStats`: Retrieves pre-calculated monthly, yearly, or financial-yearly statistics for incidents based on a specified year and statistic type.
    - `Calculate`: Evaluates a mathematical expression using the math.js library.

- **`gnoc-chart-visualizer-tool`**: This function generates SVG charts (pie, bar, or line) based on a given JSON configuration. It uploads the generated chart to an S3 bucket and returns a presigned URL to access it to amythest studio agent.

- **`gnoc-excel-upload`**: This function processes an Excel file uploaded to S3. It parses the file, normalizes the data, and then batch writes the data to a DynamoDB table. It also provides real-time progress updates to the client via a WebSocket connection.

- **`gnoc-extract-lambda`**: This function extracts structured data from a `.docx` file stored in S3. It uses the `mammoth` library to convert the document to HTML and then uses a large language model (Claude 3.5 Sonnet) to extract the data in a structured format. The extracted data is then saved to a DynamoDB table.

- **`gnoc-file-handling-lambda`**: This function handles file-related operations via a WebSocket connection. It provides the following functionalities:
    - `upload`: Generates a presigned URL to upload a file to S3.
    - `delete`: Deletes an incident from DynamoDB and updates the cached stats in S3.
    - `extract`: Triggers the `gnoc-extract-lambda` function to extract data from a `.docx` file.
    - `excel`: Triggers the `gnoc-excel-upload` function to process an Excel file.
    - `fetch`: Fetches all incidents from DynamoDB and sends them to the client via the WebSocket connection. It also sends cached or newly calculated statistics.

- **`gnoc-lambda-authenticator`**: This function is a Lambda authorizer for the API Gateway. It validates a JWT token provided in the `assertion` query string parameter. It uses a JWKS (JSON Web Key Set) to verify the token's signature and checks the issuer and audience claims.

## 2. Infrastructure

The infrastructure is managed using Terraform and is composed of the following AWS resources, all tagged with common identifiers like `airid: 227998` and `service: gnoc`.

### 2.1. S3 Buckets

-   **Frontend Application Bucket**: An S3 bucket (`var.frontend_bucket_name`) to host the static files for the React-based frontend application. This bucket is configured as the origin for the CloudFront distribution.
-   **Data Bucket**: A separate S3 bucket (`var.bucket_name`) for storing application data, including uploaded documents (`.docx`, `.xlsx`), cached statistics, and dynamically generated charts. It has a 14-day lifecycle expiration policy for objects and a CORS policy to allow access from the CloudFront domain.

### 2.2. DynamoDB Table

-   A single DynamoDB table (`var.tableName`) serves as the primary data store for incident information.
-   **Primary Key**: The table uses `Incident_Number` (`var.hashKey`) as its hash key.
-   **Global Secondary Indexes (GSIs)**: To enable efficient querying on different attributes, the following GSIs are configured:
    -   `ProblemRecordIndex-index`: For querying by `ProblemRecordIndex`.
    -   `sortIndex1-index`: For sorting and filtering.
    -   `sortIndex2-index`: For additional sorting and filtering.

### 2.3. API Gateways

-   **HTTP API Gateway**: An HTTP API Gateway (`var.http_gateway_name`) exposes RESTful endpoints for the `gnoc-ata-integaration` and `gnoc-chart-visualizer-tool` Lambda functions.
    -   **Routes**:
        -   `GET /GetIncidentById`
        -   `GET /GetIncidentsByDate`
        -   `GET /GetIncidentByProblemRecord`
        -   `GET /GetMonthlyStats`
        -   `GET /Calculate`
        -   `GET /chartVisualizer`
        -   `GET /GetAllAvailableCategories`
    -   **Security**: The API is secured using a JWT authorizer, which validates tokens based on a configured issuer (`var.issuer`) and audience (`var.audience`).
-   **WebSocket API Gateway**: A WebSocket API Gateway (`var.socket_gateway_name`) provides real-time, bidirectional communication between the frontend and the `gnoc-file-handling-lambda`.
    -   **Routes**: `$connect`, `fetch`, `delete`, `extract`, `upload`, `excel`.
    -   **Security**: The `$connect` route is secured by the `gnoc-lambda-authenticator` function, which validates a JWT passed in the `assertion` query string parameter.

### 2.4. Lambda Functions

The backend logic is executed by a set of AWS Lambda functions. See the "Backend" section for a detailed description of each function's purpose. The Terraform configuration deploys both regular and Lambda@Edge functions.

### 2.5. CloudFront Distribution

-   A CloudFront distribution serves the frontend application from the S3 bucket, providing low-latency delivery and enhanced security.
-   **Features**:
    -   **HTTPS**: Secured using an AWS Certificate Manager (ACM) certificate (`var.certfilename`).
    -   **Lambda@Edge**:
        -   `227998-cloud-eso-shim-gnoc-ai3-chatbot-stg`: Intercepts `viewer-request` events to handle authentication.
        -   `227998-cloud-secure-header-gnoc-ai3-chatbot-stg`: Intercepts `origin-response` events to add security headers.
    -   **Content Access**: Access to the S3 origin is restricted using a CloudFront Key Group. The public key is stored in the key group, and the private key is stored securely in AWS Secrets Manager (`var.secret_name`).
    -   **Caching**: Caching policies are configured to optimize performance.

### 2.6. Security and Identity

-   **ACM**: An AWS Certificate Manager (ACM) certificate is used to provide HTTPS for the CloudFront distribution.
-   **Secrets Manager**: AWS Secrets Manager is used to store the private key for the CloudFront key group.

## 3. CI/CD Pipeline

The CI/CD pipeline is defined using Azure DevOps and is composed of the following files:

- **`aws-consume-tmod-pipeline.yml`**: This is the main pipeline file. It defines the following stages:
    - **BuildLambdas**: This stage builds and packages all the Node.js Lambda functions. It installs the dependencies for each function and then creates a zip file for each one. The zip files are then published as a build artifact.
        - **Deterministic Packaging**: To optimize the deployment process and avoid unnecessary updates, this stage implements deterministic packaging for all Lambda functions. This ensures that a new version of a function is deployed only when its underlying code has actually changed. This is achieved through the following steps:
            -   **Timestamp Normalization**: Before creating the ZIP archive, all file timestamps are reset to a fixed, constant value (the Unix epoch: `1970-01-01 00:00:00`).
            -   **Permission Standardization**: File permissions are standardized to `644` for files and `755` for directories.
            -   **Consistent Archiving**: The `zip` command is used with options that ensure a consistent file order and metadata within the archive.
        As a result, if the source code of a Lambda function has not changed, the generated ZIP file will have the exact same SHA256 hash as the previous build. Terraform uses this hash to determine whether the function needs to be redeployed. This approach significantly speeds up the deployment process and reduces the risk of unintended changes.
    - **BuildFrontend**: This stage builds and packages the frontend application. It installs the dependencies and then runs the build script. The build output is then published as a build artifact.
    - **Plan**: This stage runs `terraform plan` to create an execution plan for the infrastructure changes. It uses the `aws-consume-tfmod-plan.yml` template.
    - **Apply**: This stage runs `terraform apply` to apply the infrastructure changes. It uses the `aws-consume-tfmod-apply.yml` template.

- **`aws-consume-tfmod-plan.yml`**: This is a template file that defines the steps for the `terraform plan` stage. It downloads the build artifacts, discovers the Lambda packages and Frontend Package, and then runs `terraform init`, `terraform validate`, and `terraform plan`.

- **`aws-consume-tfmod-apply.yml`**: This is a template file that defines the steps for the `terraform apply` stage. It downloads the build artifacts, discovers the Lambda packages, and then runs `terraform init` and `terraform apply`.
