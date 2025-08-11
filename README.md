# GNOC AI3 Chatbot and Incident Management Dashboard

This project is a full-stack application that includes a chatbot, an incident management dashboard, and RCA docx and MDB excel uploading capabilities. It has a React-based frontend, a serverless backend using AWS Lambda, and infrastructure as code using Terraform.

## Architecture

The application is composed of the following main components:

*   **Frontend:** A single-page application (SPA) built with React and Vite. It uses Material-UI for components, MSAL for authentication, and communicates with the backend via an API Gateway. The frontend includes a chatbot interface and a dashboard for incident management.
*   **Backend:** A set of AWS Lambda functions that provide the business logic for the chatbot, dashboard, and file uploading. These functions are triggered by an API Gateway.
*   **Infrastructure:** The entire infrastructure is defined as code using Terraform. This includes the S3 bucket for frontend hosting, Lambda functions, DynamoDB table, API Gateway, and CloudFront distribution.

### High-Level Diagram

```
[User] -> [CloudFront] -> [S3 (Frontend)]
   |             ^
   |             | (Authentication)
   v             |
[API Gateway] -> [Lambda Functions] -> [DynamoDB]
```

## Project Structure

```
.
├── frontend-src/     # React frontend application
├── infra/            # Terraform infrastructure code
└── lambda-src/       # AWS Lambda functions
```

## Getting Started

### Prerequisites

*   Node.js and npm
*   Terraform
*   AWS CLI

### Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    ```

2.  **Install frontend dependencies:**

    ```bash
    cd frontend-src
    npm install
    ```

3.  **Install backend dependencies:**

    Navigate to each directory in `lambda-src` and run `npm install`.

### Deployment

The deployment of this project is automated through a CI/CD pipeline.

## CI/CD

This project uses Azure Pipelines for continuous integration and deployment. The pipeline is defined in the following files:

*   `aws-consume-tmod-pipeline.yml`: The main pipeline file.
*   `aws-consume-tfmod-plan.yml`: Template for the Terraform plan stage.
*   `aws-consume-tfmod-apply.yml`: Template for the Terraform apply stage.

The pipeline has the following stages:

1.  **BuildLambdas:** Builds and packages all the Node.js Lambda functions from the `lambda-src` directory. The resulting zip files are published as a build artifact named `lambda-packages`.
2.  **BuildFrontend:** Builds the React frontend application from the `frontend-src` directory. The build output is published as a build artifact named `frontend-packages`.
3.  **Terraform Plan:** Runs `terraform plan` to create an execution plan for the infrastructure changes.
4.  **Terraform Apply:** Runs `terraform apply` to apply the changes to the infrastructure.

## Frontend

The frontend is a React application located in the `frontend-src` directory.

*   **Development:** `npm run dev`
*   **Build:** `npm run build`
*   **Lint:** `npm run lint`

## Backend

The backend consists of a series of AWS Lambda functions located in the `lambda-src` directory. Each subdirectory corresponds to a specific Lambda function.

## Infrastructure

The infrastructure is managed by Terraform in the `infra` directory. The `main.tf` file defines the AWS resources, and `variables.tf` defines the input variables.