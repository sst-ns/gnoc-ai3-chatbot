region          = "us-east-1"
#bucket
bucket_name     = "gnoc-ai3-bucket"
assume_role_arn = "arn:aws:iam::806818800550:role/227998-02-deployer-role"
# dynamo db
tableName="gnoc-ai3-table"
hashKey="Incident_Number"
ProblemRecordIndex="Problem_Record"
sortIndex1 = "Reported_Date_Time"
sortIndex2 = "Resolved_Date_Time"
commonValue = "CommonValue"

# lambda
handler = "index.handler"  # or your handler
runtime = "nodejs20.x"     # or your runtime
memory = 512
timeout = 300
environment_suffix = "npd"
environment_variables={
    lambdaFunctionName:"227998-gnoc-extract-lambda-npd"
    lambdaUploadFunction:"227998-gnoc-excel-upload-npd"
    TENANT_ID:"f3211d0e-125b-42c3-86db-322b19a65a22"
    AUDIENCE:"aa100a74-2e5a-4ff8-a30f-bd598a3eb18b"
}

# http api gateway
http_gateway_name = "gnoc-ata-actions-api"
route_lambda="227998-gnoc-ata-integaration-npd"
chartVisualizer_lambda = "227998-gnoc-chart-visualizer-tool-npd"
# jwt authoriser
issuer = "https://sts.windows.net/f3211d0e-125b-42c3-86db-322b19a65a22/"
audience = "https://skyline.ds.dev.accenture.com"
# socket api gateway
socket_gateway_name="gnoc-ai3-socket-api"
socket_lambda_name="227998-gnoc-file-handling-lambda-npd"
lambda_authorizer_name="gnoc-lambda-authenticator"

aliases                      = []
enabled                      = true
# viewer_request_lambda_arn    = "arn:aws:lambda:us-east-1:806818800550:function:227998-cloud-eso-shim-gnoc-chatbot-stg:7"
# origin_response_lambda_arn   = "arn:aws:lambda:us-east-1:806818800550:function:227998-cloud-secure-header-gnoc-chatbot-stg:13"
trusted_key_groups           = []

cache_policy_name                   = "SPA-Auth-Cache-Policy"
min_ttl                             = 0
cache_cookie_behavior               = "whitelist"
cache_cookie_items                  = ["CloudFront-Key-Pair-Id", "CloudFront-Signature", "CloudFront-Policy", "accessToken"]
cache_header_behavior               = "whitelist"
cache_header_items                  = ["X-TOKEN", "Authorization"]
cache_query_string_behavior         = "whitelist"
cache_query_string_items            = ["path", "route", "state", "code", "session_state"]  

origin_request_policy_name          = "SPA-Auth-Origin-Request-Policy"
origin_cookie_behavior              = "whitelist"
origin_cookie_items                 = ["CloudFront-Key-Pair-Id", "CloudFront-Signature", "CloudFront-Policy", "accessToken"]
origin_header_behavior              = "whitelist"
origin_header_items                 = ["X-TOKEN", "User-Agent", "Referer","Origin", "accessToken"]
origin_query_string_behavior        = "whitelist"
origin_query_string_items           = ["path", "route", "state", "code", "session_state"]

action     = "upload"
path= "/__w/1/frontend-packages"
sub_folder =  "null"
encoded_key  = "227998-gnoc-ai3-dashboard-stg-publickey.pem"
aws_app_name = "gnoc-ai3-dashboard"
aws_env_name = "stg"
certfilename  = "227998-gnoc-chatbot-spa-stg-sslcert.pem"
keyfilename   = "227998-gnoc-chatbot-spa-stg-privatekey.key"
chainfilename = "227998-gnoc-chatbot-spa-stg-certchain.pem"
frontend_bucket_name = "gnocfrontendai3bucket"

secret_name  = "keypair-gnoc-ai3-dashboard-stg"

eso_shim_lambda  = "227998-cloud-eso-shim-gnoc-ai3-chatbot-stg"
secure_header_lambda = "227998-cloud-secure-header-gnoc-ai3-chatbot-stg"
