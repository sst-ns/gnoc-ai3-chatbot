'use strict';
exports.handler = (event, context, callback) => {
    const response = event.Records[0].cf.response;
    const request = event.Records[0].cf.request;
    // Get only the extension name, removing also queryString parameters
    let file_ext = request.uri.split(".").pop();
    file_ext = file_ext.split("?")[0];
    const fonts = {
        "eot": "application/vnd.ms-fontobject",
        "ttf": "application/x-font-ttf",
        "woff": "application/font-woff",
        "woff2": "application/font-woff2"
    };
    const headers = response.headers;
    const headerNameXFrameOptions = 'X-Frame-Options';
    const headerNameXContentTypeOptions = 'X-Content-Type-Options';
    const headerNameCacheControl = 'Cache-Control';
    const headerNameContentSecurityPolicy = 'Content-Security-Policy';
    const headerNameStrictTransportSecurity = 'Strict-Transport-Security';
    const headerNameXXSSProtection = 'X-Xss-Protection';
    const headerNameAmzServerSideEncryption = 'x-amz-server-side-encryption';
    const targetXFrameOptions = [{ value: "SAMEORIGIN", key: "X-Frame-Options" }];
    const targetXContentTypeOptions = [{ value: "nosniff", key: "X-Content-Type-Options" }];
    const targetCacheControl = [{ value: "public, max-age=31536000", key: "Cache-Control" }];
    const targetContentSecurityPolicy = [{ value: "default-src 'self' 'unsafe-eval' 'unsafe-inline' *.accenture.com *.microsoftonline.com cdnjs.cloudflare.com cdn.jsdelivr.net *.azurewebsites.net; script-src 'self' 'unsafe-inline' 'unsafe-eval' *.accenture.com *.botframework.com *.microsoftonline.com cdn.botframework.com *.datadoghq-browser-agent.com; img-src 'self' *.accenture.com data: blob:; connect-src 'self' *.accenture.com *.microsoftonline.com https://rum.browser-intake-datadoghq.com *.datadoghq.com directline.botframework.com 227998-gnocbot-stg.azurewebsites.net 227998-gnocbot-prod.azurewebsites.net *.microsoft.com https://graph.microsoft.com wss://directline.botframework.com wss://*.execute-api.us-east-1.amazonaws.com https://*.lambda-url.us-east-1.on.aws  https://227998-02-gnoc-ai3-bucket.s3.us-east-1.amazonaws.com; font-src 'self' fonts.gstatic.com *.accenture.com data:", key: "Content-Security-Policy" }];
    const targetStrictTransportSecurity = [{ value: "max-age=31536000; includeSubDomains", key: "Strict-Transport-Security" }];
    const targetXXSSProtection = [{ value: "1; mode=block", key: "X-Xss-Protection" }];
    // Set `server` header to blank instead of default value AmazonS3
    headers["server"] = [{ value: "", key: "server" }];
    headers["Server"] = [{ value: "", key: "server" }];
    //Deleting amz server side encryption headers
    if (headers[headerNameAmzServerSideEncryption]) {
        delete headers[headerNameAmzServerSideEncryption];
    }
    headers[headerNameXFrameOptions] = targetXFrameOptions;
    headers[headerNameXContentTypeOptions] = targetXContentTypeOptions;
    headers[headerNameContentSecurityPolicy] = targetContentSecurityPolicy;
    headers[headerNameStrictTransportSecurity] = targetStrictTransportSecurity;
    headers[headerNameXXSSProtection] = targetXXSSProtection;
    // cache-control
    if (fonts[file_ext]) {
        headers[headerNameCacheControl] = [{
                value: "max-age=0",
                key: "Cache-Control"
            }
        ];
        headers["Content-Type"] = [{
                value: fonts[file_ext],
                key: "Content-Type"
            }
        ];
    }
    else {
        headers[headerNameCacheControl] = targetCacheControl;
    }
    callback(null, response);
};
//# sourceMappingURL=index.js.map