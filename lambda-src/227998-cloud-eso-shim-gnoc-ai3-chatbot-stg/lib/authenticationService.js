"use strict";
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
exports.AuthenticationError = exports.AzADAuthService = exports.AuthValidator = exports.decode = exports.initClient = exports.getJson = void 0;
const https = __importStar(require("https"));
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function getJson(url) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            https
                .get(url, (res) => {
                let data = '';
                // A chunk of data has been received.
                res.on('data', (chunk) => {
                    data += chunk.toString();
                });
                // The whole response has been received. Resolve the Promise.
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            })
                .on('error', (err) => {
                reject(err);
            });
        });
    });
}
exports.getJson = getJson;
const verifyJwtAsync = (token, key, options) => {
    return new Promise((resolve, reject) => {
        jsonwebtoken_1.default.verify(token, key, options, (err, decoded) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(decoded);
            }
        });
    });
};
/**
 * initializes a new JwksClient for a given metadataUri
 * @param metadataUri
 * @returns JwksClient
 */
function initClient(metadataUri, configIssuer) {
    return __awaiter(this, void 0, void 0, function* () {
        const openIdConfig = yield getJson(metadataUri);
        if (!openIdConfig.jwks_uri) {
            throw new Error(`Cannot read property 'jwks_uri' of undefined`);
        }
        // https://github.com/auth0/node-jwks-rsa
        const client = (0, jwks_rsa_1.default)({
            jwksUri: openIdConfig.jwks_uri,
            cache: true,
            cacheMaxEntries: parseInt('5', 10),
            cacheMaxAge: parseInt('600000', 10),
            rateLimit: true,
            jwksRequestsPerMinute: parseInt('10', 10),
            timeout: parseInt('3000', 10),
        });
        /*
        prefer the optional configured env.ISSUER value over the one returned by the endpoint.
        */
        const issuer = configIssuer ? configIssuer : openIdConfig.issuer;
        return Promise.resolve({ client, issuer });
    });
}
exports.initClient = initClient;
function decode(token) {
    return jsonwebtoken_1.default.decode(token, {
        complete: true,
    });
}
exports.decode = decode;
class AuthValidator {
    constructor(config) {
        Object.setPrototypeOf(this, new.target.prototype);
        this.config = config;
    }
    refreshKeysAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            const { client, issuer } = yield initClient(this.config.metadataUri, this.config.issuer);
            this.jwksClient = client;
            this.config.issuer = issuer;
            this.getSigningKeyAsync = yield this.getAsyncRefresh();
        });
    }
    getAsyncRefresh() {
        const refreshAsync = (key) => {
            return new Promise((resolve, reject) => {
                this.jwksClient.getSigningKey(key, (err, result) => {
                    if (err) {
                        reject(err);
                    }
                    else if (result === undefined) {
                        reject(new Error('Signing key is undefined'));
                    }
                    else {
                        resolve(result);
                    }
                });
            });
        };
        return refreshAsync;
    }
}
exports.AuthValidator = AuthValidator;
class AzADAuthService extends AuthValidator {
    authorizeAsync(jwt) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const decodedToken = decode(jwt);
            if (!decodedToken) {
                throw new AuthenticationError(new Error('Invalid Token Decode'), 401, 'INVALID_TOKEN_DECODE');
            }
            const publicKey = (_b = (yield this.getSigningKeyAsync((_a = decodedToken.header) === null || _a === void 0 ? void 0 : _a.kid))) === null || _b === void 0 ? void 0 : _b.getPublicKey();
            // console.log(`jwt.iss: ${decodedToken.payload?.iss} expected: ${this.config.issuer}`);
            const verifiedToken = yield verifyJwtAsync(jwt, publicKey, {
                issuer: this.config.issuer,
                audience: this.config.audience,
            });
            return verifiedToken != null;
        });
    }
}
exports.AzADAuthService = AzADAuthService;
class AuthenticationError extends Error {
    constructor(innerError, status = 500, reason = 'UNKNOWN', isWarning = false) {
        super((innerError === null || innerError === void 0 ? void 0 : innerError.message) || `[${status}] ${reason}`);
        this.innerError = innerError;
        this.status = status;
        this.reason = reason;
        this.isWarning = isWarning;
        this.extraHeaders = {};
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = this.constructor.name;
    }
}
exports.AuthenticationError = AuthenticationError;
