/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-use-before-define */
'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJWT = exports.hasSecureCookie = exports.createSecureCookie = exports.handler = exports.initSecretsManager = exports._SECURE_HEADERS = exports._SECURE_COOKIE_NAMES = exports._SECURE_COOKIE_HEADER = exports._SECURE_COOKIE_PATH = void 0;
const fs_1 = __importDefault(require("fs"));
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const crypto_1 = require("crypto");
const cloudfront = __importStar(require("@aws-sdk/cloudfront-signer"));
const env_json_1 = __importDefault(require("../env.json"));
const authenticationService_1 = require("./authenticationService");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const version = require('../package.json').version;
const _PATH_COOKIE_NAME = 'P';
exports._SECURE_COOKIE_PATH = 'securecookie';
exports._SECURE_COOKIE_HEADER = 'X-TOKEN';
exports._SECURE_COOKIE_NAMES = ['CloudFront-Key-Pair-Id', 'CloudFront-Signature', 'CloudFront-Policy'];
const MSAL_HOST = 'https://cdn.jsdelivr.net';
// https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/cdn-usage.md
const MSAL_LIBRARY = `${MSAL_HOST}/npm/@azure/msal-browser@3.3.0/lib/msal-browser.min.js`;
const MSAL_SRI = `sha256-leCw2RO6LCx2s+6OjJLsUEINph5SNhW3KgmuaRJczrA=`;
let aadRedirectPage = `
<!DOCTYPE html>
<html lang='en' xmlns='http://www.w3.org/1999/xhtml'>
<head><meta charset='utf-8' /><meta http-equiv="X-UA-Compatible" content="IE=Edge" /><link rel='icon' href='https://portal.accenture.com/images/favicon.ico'> <title>${env_json_1.default.APPLICATION}</title>
<script src='${MSAL_LIBRARY}' integrity='${MSAL_SRI}' crossorigin='anonymous'></script></head>
<body><h3>Checking Authentication…</h3><script>{{SCRIPT}}</script><!-- Version: ${version} --></body>
</html>
`;
let aadRedirectJS = fs_1.default.readFileSync(__dirname + '/authCodeAadRedirect.min.js', 'utf8').toString();
aadRedirectJS = aadRedirectJS.replace(`{{CLIENT_ID}}`, env_json_1.default.CLIENT_ID);
aadRedirectJS = aadRedirectJS.replace(`{{DOMAIN}}`, env_json_1.default.DOMAIN);
aadRedirectJS = aadRedirectJS.replace(`{{AUTHORITY}}`, env_json_1.default.AUTHORITY);
aadRedirectJS = aadRedirectJS.replace(`{{PATH}}`, exports._SECURE_COOKIE_PATH);
aadRedirectJS = aadRedirectJS.replace(`{{HEADER}}`, exports._SECURE_COOKIE_HEADER);
aadRedirectPage = aadRedirectPage.replace(`{{SCRIPT}}`, `${aadRedirectJS}`);
const HASH_ALG = 'sha384';
const checkSum = (0, crypto_1.createHash)(HASH_ALG).update(aadRedirectJS, 'utf8').digest('base64');
exports._SECURE_HEADERS = {
    'cache-control': [{ key: 'Cache-Control', value: 'no-store' }],
    'content-Security-policy': [
        {
            key: 'Content-Security-Policy',
            value: `default-src 'self' '${HASH_ALG}-${checkSum}'; script-src 'unsafe-inline'  '${HASH_ALG}-${checkSum}'  ${MSAL_HOST} ;connect-src 'self'  login.microsoftonline.com; frame-src 'self' login.microsoftonline.com; base-uri 'self' ; upgrade-insecure-requests; block-all-mixed-content; img-src portal.accenture.com;object-src 'none'`,
        },
    ],
    'referrer-policy': [{ key: 'Referrer-Policy', value: 'same-origin' }],
    server: [{ key: 'Server', value: '' }],
    Server: [{ key: 'Server', value: '' }],
    'strict-transport-security': [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000;includeSubdomains;preload' },
    ],
    'x-content-type-options': [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
    'x-frame-options': [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
    'x-xss-protection': [{ key: 'X-XSS-Protection', value: '1; mode=block' }],
};
const MAX_AGE_IN_SECONDS = 86400; // 1 day
let authService;
let resolvedKeyPair;
const init = () => __awaiter(void 0, void 0, void 0, function* () {
    if (resolvedKeyPair) {
        return Promise.resolve(resolvedKeyPair);
    }
    return yield Promise.all([
        (0, exports.initSecretsManager)(),
        initTokenValidator({
            // v1 endpoint:
            // metadataUri: `https://login.microsoftonline.com/${env.AUTHORITY}/.well-known/openid-configuration`,
            // v2 endpoint
            metadataUri: `https://login.microsoftonline.com/${env_json_1.default.AUTHORITY}/v2.0/.well-known/openid-configuration`,
            audience: env_json_1.default.CLIENT_ID,
        }),
    ]);
});
const initSecretsManager = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const start = Date.now();
    if (resolvedKeyPair) {
        return Date.now() - start;
    }
    const sm = yield new client_secrets_manager_1.SecretsManager({
        region: env_json_1.default.REGION,
    });
    const secret = (_a = (yield sm.getSecretValue({
        SecretId: env_json_1.default.SECRETS_MANAGER_CLOUDFRONT_KEY,
    }))) === null || _a === void 0 ? void 0 : _a.SecretString;
    if (!secret) {
        console.error('Fatal error initializing SecretsManager keys\n%O');
        process.exit(101);
    }
    const result = JSON.parse(secret);
    console.log(result)
    const decoded = Buffer.from(result.PrivateKey, 'base64').toString();
    result.PrivateKey = decoded.replace(/\\n/g, '\n');
    resolvedKeyPair = Object.assign({}, result);
    return Date.now() - start;
});
exports.initSecretsManager = initSecretsManager;
const initTokenValidator = (config) => __awaiter(void 0, void 0, void 0, function* () {
    const start = Date.now();
    authService = new authenticationService_1.AzADAuthService(config);
    try {
        yield authService.refreshKeysAsync();
    }
    catch (error) {
        console.error('Fatal error initializing authentication keys\n%O', error);
        process.exit(101);
    }
    return Date.now() - start;
});
let INSTANCE_COUNT = 0;
const handler = (event) => __awaiter(void 0, void 0, void 0, function* () {
    INSTANCE_COUNT += 1;
    if (INSTANCE_COUNT <= 1) {
        console.log(`starting up lambda`);
        yield init();
    }
    const request = event.Records[0].cf.request; // Get request from CloudFront event
    const jwt = getJWT(request);
    const sc = hasSecureCookie(request);
    if (!sc && !jwt) {
        console.log('no JWT found, no secure cookies -> bootstrapping azure AD login');
        return Object.assign({}, _RESPONSE_OK, { body: aadRedirectPage });
    }
    if (jwt && !sc) {
        console.log('handler - jwt - yes sc - no');
        try {
            const tokenValidated = yield authenticateToken(jwt);
            if (!tokenValidated) {
                return Object.assign({}, _NOT_AUTHORIZED_RESPONSE, { body: 'Token Failed Verification' });
            }
            return yield createSecureCookie();
        }
        catch (error) {
            console.log(`Error - ${error}`);
            return Object.assign({}, _NOT_AUTHORIZED_RESPONSE, { body: error.message });
        }
    }
    if (sc) {
        return request;
    }
});
exports.handler = handler;
function authenticateToken(jwt) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!jwt) {
                throw new Error('Missing Bear Token');
            }
            const tokenValidated = yield authService.authorizeAsync(jwt);
            if (tokenValidated) {
                return Promise.resolve(true);
            }
            else {
                return Promise.resolve(false);
            }
        }
        catch (err) {
            console.log('authError.status - ' + err.status + ' authError.message - ' + err.message);
        }
        return Promise.resolve(false);
    });
}
function createSecureCookie() {
    return __awaiter(this, void 0, void 0, function* () {
        const resourcePath = 'https://' + env_json_1.default.DOMAIN + '/*';
        const locationPath = 'https://' + env_json_1.default.DOMAIN;
        const expires = Math.round(Date.now() / 1000) + MAX_AGE_IN_SECONDS;
        const url = 'https://' + env_json_1.default.DOMAIN;
        const privateKey = resolvedKeyPair.PrivateKey;
        const keyPairId = resolvedKeyPair.KeyPairId;

        const policy = {
            Statement: [
                {
                    Resource: resourcePath,
                    Condition: {
                        DateLessThan: { 'AWS:EpochTime': expires },
                    },
                },
            ],
        };

        const cookie = cloudfront.getSignedCookies({
            url,
            privateKey,
            keyPairId,
            policy: JSON.stringify(policy),
        });

        return {
            status: '302',
            statusDescription: 'Redirecting',
            headers: Object.assign(Object.assign({
                'set-cookie': [
                    {
                        key: 'Set-Cookie',
                        value:
                            'CloudFront-Key-Pair-Id=' +
                            cookie['CloudFront-Key-Pair-Id'] +
                            '; Max-Age=' +
                            MAX_AGE_IN_SECONDS +
                            '; Secure; HttpOnly; Path=/; SameSite=Lax',
                    },
                    {
                        key: 'Set-Cookie',
                        value:
                            'CloudFront-Signature=' +
                            cookie['CloudFront-Signature'] +
                            '; Max-Age=' +
                            MAX_AGE_IN_SECONDS +
                            '; Secure; HttpOnly; Path=/; SameSite=Lax',
                    },
                    {
                        key: 'Set-Cookie',
                        value:
                            'CloudFront-Policy=' +
                            cookie['CloudFront-Policy'] +
                            '; Max-Age=' +
                            MAX_AGE_IN_SECONDS +
                            '; Secure; HttpOnly; Path=/; SameSite=Lax',
                    },
                    {
                        key: 'Set-Cookie',
                        value:
                            _PATH_COOKIE_NAME +
                            '=; Max-Age=0; Secure; HttpOnly; Path=/; SameSite=Lax',
                    },
                ],
                location: [
                    {
                        key: 'Location',
                        value: locationPath,
                    },
                ],
            }, exports._SECURE_HEADERS)),
        };
    });
}
exports.createSecureCookie = createSecureCookie;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasSecureCookie(request) {
    let hasSecureCookies = false;
    if (request && request.headers && request.headers.cookie && Array.isArray(request.headers.cookie)) {
        // flatten the cookies array into just cookie names
        // headers: {cookie: [{'value': 'abc=1235;'}, {'value': 'def=1;ghi=3;}]}
        // cookieKeys becomes ['abc','def','ghi']
        let cookieKeys = [];
        request.headers.cookie.forEach((cookieHeader) => {
            cookieKeys = cookieKeys.concat(cookieHeader.value.split(';').map((cookie) => cookie.split('=')[0].trim()));
        });
        // ensure each of our secure names is in the list of cookiekeys.
        hasSecureCookies = exports._SECURE_COOKIE_NAMES.every((val) => cookieKeys.includes(val));
    }
    return hasSecureCookies;
}
exports.hasSecureCookie = hasSecureCookie;
function getJWT(request) {
    if (request['uri'].indexOf(exports._SECURE_COOKIE_PATH) > -1 &&
        request.method == 'GET' &&
        request.headers[exports._SECURE_COOKIE_HEADER.toLowerCase()]) {
        return request.headers[exports._SECURE_COOKIE_HEADER.toLowerCase()][0].value;
    }
    return undefined;
}
exports.getJWT = getJWT;
const _RESPONSE_OK = {
    status: '200',
    statusDescription: 'OK',
    headers: Object.assign({ 'content-type': [
            {
                key: 'Content-Type',
                value: 'text/html',
            },
        ], 'content-encoding': [
            {
                key: 'Content-Encoding',
                value: 'UTF-8',
            },
        ] }, exports._SECURE_HEADERS),
};
const _NOT_AUTHORIZED_RESPONSE = {
    status: '401',
    statusDescription: 'not authorized',
    headers: exports._SECURE_HEADERS,
};
