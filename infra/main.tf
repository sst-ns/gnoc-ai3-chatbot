terraform {
  backend "azurerm" {}
}

provider "aws" {
  access_key = var.access_key
  secret_key = var.secret_key
  region     = var.region
  assume_role {
    role_arn = var.assume_role_arn
  }
}

locals {
  # --- Common tags -----------------------------------------------------------
  tags = {
    airid       = "227998"
    environment = "npd"
    tf_mod      = "na"
    env         = "npd"
    service     = "gnoc"
    version     = "0.0.1"
  }

  # --- Regular Lambda functions (skip any file that starts with “227998”) ----
  lambda_functions = {
    for filename in var.lambda_files :
    replace(filename, ".zip", "") => {
      filename      = filename
      function_name = "${replace(filename, ".zip", "")}-${var.environment_suffix}"
    }
    if !startswith(filename, "227998")
  }
}

module "aws_s3" {
  source               = "acnciotfregistry.accenture.com/accenture-cio/s3/aws"
  version              = "4.2.1"
  bucket_name          = var.bucket_name
  enable_force_destroy = true
  lifecycle_expiration = 14
  cors_rule = [
      {
          id             = "cors"
          allowed_headers = ["*"]
          allowed_methods = ["GET", "PUT"]
          allowed_origins = ["https://d2qf9kul80tj8l.cloudfront.net"]
          expose_headers  = ["Etag","x-amz-request-id","x-amz-id-2"]
          max_age_seconds = 3000
      }
  ]
}

module "lambda" {
  source = "acnciotfregistry.accenture.com/accenture-cio/lambda/aws"
  version = "6.1.3"
  
  for_each = local.lambda_functions
  
  function_name = each.value.function_name
  handler       = var.handler
  filename_path = "${var.lambda_path}/${each.value.filename}"
  runtime       = var.runtime
  memory        = var.memory
  timeout       = var.timeout
  environment_variables=merge(var.environment_variables,{
    bucket_name=tostring(module.aws_s3.bucket.bucket)
    tableName = tostring(module.dynamodb.dynamodb)
    ProblemRecordIndex="${var.ProblemRecordIndex}-index"
    sortIndex1="${var.sortIndex1}-index"
    sortIndex2="${var.sortIndex2}-index"
    region=var.region
  })
  lambda_authorizer= each.value.function_name == var.lambda_authorizer_name ? "Yes": "No"
}

module "dynamodb" {
  source           = "acnciotfregistry.accenture.com/accenture-cio/dynamodb/aws"
  version          = "4.0.1"
  tableName        = var.tableName
  rangeKey         = null
  hashKey          = var.hashKey
  ttlAttributeName = null
  pitrEnabled      = false
  ttlEnabled       = false
  streamEnabled    = false
  attributes = [
    {
      name = var.hashKey
      type = "S"
    },
    {
      name = var.ProblemRecordIndex
      type = "S"
    },
    {
      name= var.commonValue
      type="S"
    },
    {
      name= var.sortIndex1
      type="S"
    },
    {
      name=var.sortIndex2
      type="S"
    }
  ]
  globalSecondaryIndex = [
    {
      name             = "${var.ProblemRecordIndex}-index"
      hashKey          = var.ProblemRecordIndex
      rangeKey         = null
      projectionType   = "ALL"
      nonKeyAttributes = []
    },
    {
      name  = "${var.sortIndex1}-index"
      hashKey = var.commonValue
      rangeKey= var.sortIndex1
      projectionType="ALL"
      nonKeyAttributes=[]
    },
    {
      name="${var.sortIndex2}-index"
      hashKey=var.commonValue
      rangeKey=var.sortIndex2
      projectionType="ALL"
      nonKeyAttributes=[]
    }
  ]
}

module "apigatewayv2" {
  source         = "acnciotfregistry.accenture.com/accenture-cio/apigatewayv2/aws"
  version        = "5.1.0"
  gateway_name   = var.http_gateway_name
  description    = "gnoc ai3 ata actions api"
  cors_configuration = {
    allow_credentials = true
    allow_headers = ["*"]
    allow_methods = ["GET", "POST"]
    expose_headers = ["content-type"]
    max_age = 3600
  }
  cors_allow_origins = ["https://amethyststudio.accenture.com"]

  stages = {
    "default" = {
      auto_deploy = true
    }
  }

  routes_and_integrations = {
    "GET /GetIncidentById" = {
      lambda_int_name      = var.route_lambda
      timeout_milliseconds = 29000
      authorizer           = "jwtauth1"
    }

    "GET /GetIncidentsByDate" = {
      lambda_int_name      = var.route_lambda
      timeout_milliseconds = 29000
      authorizer           = "jwtauth1"
    }
    "GET /GetIncidentByProblemRecord"={
      lambda_int_name      = var.route_lambda
      timeout_milliseconds = 29000
      authorizer           = "jwtauth1"      
    }
    "GET /chartVisualizer"={
      lambda_int_name=var.chartVisualizer_lambda
      timeout_milliseconds=29000
      authorizer="jwtauth1"
    }
    "GET /GetMonthlyStats"={
      lambda_int_name      = var.route_lambda
      timeout_milliseconds = 29000
      authorizer           = "jwtauth1"      
    }
    "GET /Calculate"={
      lambda_int_name     = var.route_lambda
      timeout             = 29000
      authorizer          = "jwtauth1"
    }
  }
  authorizers = {
    "jwtauth1" = {
      identity_sources = ["$request.header.authorization"]
      audience         = [var.audience]
      issuer           = var.issuer
    }
  }
  depends_on = [ module.lambda ]
}

module "apigatewayv2websocket" {
  source                     = "acnciotfregistry.accenture.com/accenture-cio/apigatewayv2/aws"
  gateway_name               = var.socket_gateway_name
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  stages = {
    "default" = {
      auto_deploy = true
    }
  }

  routes_and_integrations = {
    "$connect" = {
      lambda_int_name      = var.socket_lambda_name #Lambda Function name
      timeout_milliseconds = 29000
      authorizer           =  "lambdaAuthorizer"
    },
    "fetch"={
      lambda_int_name      = var.socket_lambda_name 
      timeout_milliseconds = 29000
    },
    "delete"={
      lambda_int_name      = var.socket_lambda_name 
      timeout_milliseconds = 29000
    },
    "extract"={
      lambda_int_name      = var.socket_lambda_name 
      timeout_milliseconds = 29000
    }
    "upload"={
      lambda_int_name      = var.socket_lambda_name
      timeout_milliseconds = 29000
    }
    "excel"={
      lambda_int_name=var.socket_lambda_name
      timeout_milliseconds=29000
    }
  }

  authorizers = {
    "lambdaAuthorizer" = {  #Authorizer name
      lambda_auth_name = "${local.tags.airid}-${var.lambda_authorizer_name}-${var.environment_suffix}"
      identity_sources = "route.request.querystring.assertion"

    }
  }
  depends_on = [module.lambda]
}
module "lambda-eso-shim" {
  source                        = "acnciotfregistry.accenture.com/accenture-cio/edgelambda/aws"
  version                       = "5.1.6"
  filename_path                 = "${var.lambda_path}/${var.eso_shim_lambda}.zip"
  aws_app_name                  = "gnoc-ai3-dashboard"
  aws_env_name                  = "stg"
  log_retention                 = 30
  runtime                       = "nodejs22.x"
}

module "lambda-eso-secure-header" {
  source                        = "acnciotfregistry.accenture.com/accenture-cio/edgelambda/aws"
  version                       = "5.1.6"
  filename_path                 = "${var.lambda_path}/${var.secure_header_lambda}.zip"
  aws_app_name                  = "gnoc-ai3-dashboard"
  aws_env_name                  = "stg"
  log_retention                 = 30
  runtime                       = "nodejs22.x"
}

module "acm" {
  source        = "acnciotfregistry.accenture.com/accenture-cio/acm/aws"
  version       = "3.0.1"
  certfilename  = var.certfilename
  keyfilename   = var.keyfilename
  chainfilename = var.chainfilename
}

module "cloudfront-keygroup" {
  source           = "acnciotfregistry.accenture.com/accenture-cio/cloudfront-keygroup/aws"
  version          = "4.0.0"
  encoded_key      = var.encoded_key
  aws_app_name     = var.aws_app_name
  aws_env_name     = var.aws_env_name
}

module "cloudfront-secret" {
  source      = "acnciotfregistry.accenture.com/accenture-cio/secrets-manager/aws"
  version     = "3.0.0"
  secret_name = var.secret_name
  secrets = {
    KeyPairId  = "${module.cloudfront-keygroup.public_key_id}"
    PrivateKey = var.private_key
  }
}

module "cloudfront" {
  source                              = "acnciotfregistry.accenture.com/accenture-cio/cloudfront/aws"
  version                             = "5.2.0"

  bucket_name                         = var.frontend_bucket_name
  aliases                             = var.aliases
  enabled                             = var.enabled
  certificate_arn                     = module.acm.arn
  trusted_key_groups                  = [module.cloudfront-keygroup.key_group_id]
  viewer_request_lambda_arn           = module.lambda-eso-shim.qualified_arn	
  origin_response_lambda_arn          = module.lambda-eso-secure-header.qualified_arn

  cache_policy_name                   = var.cache_policy_name
  min_ttl                             = var.min_ttl
  cache_cookie_behavior               = var.cache_cookie_behavior
  cache_cookie_items                  = var.cache_cookie_items
  cache_header_behavior               = var.cache_header_behavior
  cache_header_items                  = var.cache_header_items
  cache_query_string_behavior         = var.cache_query_string_behavior
  cache_query_string_items            = var.cache_query_string_items

  origin_request_policy_name          = var.origin_request_policy_name
  origin_cookie_behavior              = var.origin_cookie_behavior
  origin_cookie_items                 = var.origin_cookie_items
  origin_header_behavior              = var.origin_header_behavior
  origin_header_items                 = var.origin_header_items
  origin_query_string_behavior        = var.origin_query_string_behavior
  origin_query_string_items           = var.origin_query_string_items

  depends_on = [module.cloudfront-keygroup]
}

module "aws_s3_file_upload" {
  source                          = "acnciotfregistry.accenture.com/accenture-cio/s3fileupload/aws"
  version                         = "4.0.2"
  sub_folder                      = var.sub_folder
  bucket_name                     = module.cloudfront.s3_id
  path                            = var.frontend_path
  action                          = var.action 
 depends_on = [module.cloudfront]
}


