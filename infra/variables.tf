variable "access_key" {
  description = "AWS access key"
  type        = string
}

variable "secret_key" {
  description = "AWS secret key"
  type        = string
}

variable "region" {
  description = "Region"
  type        = string
  default     = ""
}

variable "assume_role_arn" {
  description = "AWS Assume Role ARN"
  type        = string
  default     = ""
}

variable "bucket_name" {
  description = "s3 bucket to keep files for chatbot KB"
  type        = string
  default     = ""
}
variable "lambda_files" {
  description = "List of Lambda ZIP files"
  type        = list(string)
  default     = []
}

variable "lambda_path" {
  description = "Path to Lambda deployment packages"
  type        = string
}

variable "environment_suffix" {
  description = "Environment suffix for Lambda function names"
  type        = string
  default     = "npd"
}


variable "handler" {
  type        = string
}

variable "runtime" {
  type        = string
  validation {
    condition = (
      var.runtime == "dotnet8" || var.runtime == "nodejs18.x" || var.runtime == "nodejs20.x" || var.runtime == "nodejs22.x"
    )
    error_message = "The runtime must be dotnet8, nodejs18.x, nodejs20.x, or nodejs22.x."
  }
}

variable "memory" {
  type        = number
}

variable "timeout" {
  type        = number
}

variable "environment_variables" {
  description = "Environment Variables to be used in your Lambda Function. If none, put null."
  type        = map(any)
  default     = null
}

variable "tableName" {
  description = "Name of the table"
  type        = string
}

variable "hashKey" {
  description = "Hash key of the table"
  type        = string
}

variable "ProblemRecordIndex" {
  type = string
  description = "Name of secondary index partition key "
}

variable "sortIndex1" {
  type=string  
}
variable "sortIndex2" {
   type = string
 }
variable "commonValue"{
  type=string  
}
#api gateway

variable "http_gateway_name" {
  description = "http api gateway name"  
}

variable "route_lambda" {
 description = "name of lambda connnected to various routes" 
}
variable "chartVisualizer_lambda" {
  description = "name of chart visualizer lambda"
  type = string
}

variable "issuer" {
  description = "issuer for the jwt auth"
}

variable "audience" {
  description = "audience of jwt auth"
}

variable "aliases" {
  description = "List of domain aliases"
  type        = list(string)
}

variable "enabled" {
  description = "Whether CloudFront distribution is enabled"
  type        = bool
}

# variable "viewer_request_lambda_arn" {
#   description = "Lambda@Edge ARN for viewer request"
#   type        = string
# }

# variable "origin_response_lambda_arn" {
#   description = "Lambda@Edge ARN for origin response"
#   type        = string
# }


variable "cache_policy_name" {
  type        = string
  description = "Name of the cache policy"
}

variable "min_ttl" {
  type        = number
  description = "Minimum TTL for objects in CloudFront cache"
}

variable "cache_cookie_behavior" {
  type        = string
  description = "Cache policy for cookies"
}

variable "cache_cookie_items" {
  type        = list(string)
  description = "List of cookie names to cache"
}

variable "cache_header_behavior" {
  type        = string
  description = "Cache policy for headers"
}

variable "cache_header_items" {
  type        = list(string)
  description = "List of header names to cache"
}

variable "cache_query_string_behavior" {
  type        = string
  description = "Cache policy for query strings"
}

variable "cache_query_string_items" {
  type        = list(string)
  description = "List of query string parameters to cache"
}

variable "origin_request_policy_name" {
  type        = string
  description = "Name of the origin request policy"
}

variable "origin_cookie_behavior" {
  type        = string
  description = "Origin request cookie behavior"
}

variable "origin_cookie_items" {
  type        = list(string)
  description = "List of origin request cookies"
}

variable "origin_header_behavior" {
  type        = string
  description = "Origin request header behavior"
}

variable "origin_header_items" {
  type        = list(string)
  description = "List of origin request headers"
}

variable "origin_query_string_behavior" {
  type        = string
  description = "Origin request query string behavior"
}

variable "origin_query_string_items" {
  type        = list(string)
  description = "List of origin request query string parameters"
}

variable "action" {
  type        = string
  description = "S3 action type like upload"
}

variable "frontend_path" {
  description = "Path to frontend build files"
  type        = string
}

variable "path" {
  description = "manual frontend path"
  type = string
}
// variable "acm_certificate_arn" {
//   description = "The ARN of the ACM certificate to use for CloudFront"
//   type        = string
//   default     = ""
// }

variable "sub_folder" {
   type        = string
   description = "Folder to delete from S3 (only for delete action)"
   default     = "."
 }

variable "encoded_key" {
  type        = string
  description = "Base64 encoded public key used in CloudFront key group"
}

variable "aws_app_name" {
  type        = string
  description = "AWS application name used in naming resources"
}

variable "aws_env_name" {
  type        = string
  description = "AWS environment name used in naming resources"
}

variable "trusted_key_groups" {
  description = "List of trusted key group IDs"
  type        = list(string)
}

variable "certfilename" {
  type        = string
  description = "SSL certificate PEM file"
}

variable "keyfilename" {
  type        = string
  description = "SSL private key PEM file"
}

variable "chainfilename" {
  type        = string
  description = "SSL certificate chain PEM file"
}
variable "frontend_bucket_name" {
  description = "s3 bucket to keep files for chatbot KB"
  type        = string
  default     = ""
}

variable "socket_gateway_name" {
  description = "name of socket api gateway"  
  type = string
  default = ""
}

variable "lambda_authorizer_name" {
  description = "name of the lambda authorizer"
  type = string
  default = ""
}

variable "socket_lambda_name" {
  description = "name of lambda integrated socket gateway"
  type =   string
  default = ""
}

variable "secret_name" {
  type        = string
  description = "Secret name"
}

variable "private_key" {
  type = string
}

variable "secure_header_lambda" {
  type = string
}

variable "eso_shim_lambda" {
  type =  string
}

