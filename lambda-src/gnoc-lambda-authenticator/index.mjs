import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const tenantId = process.env.TENANT_ID;
const expectedAudience = process.env.AUDIENCE;

if (!tenantId || !expectedAudience) {
  throw new Error("TENANT_ID and AUDIENCE environment variables must be defined");
}

const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;

const jwks = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 5,
  rateLimit: true,
});

function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      const signingKey = key.getPublicKey ? key.getPublicKey() : key.rsaPublicKey;
      resolve(signingKey);
    });
  });
}

function generatePolicy(principalId, effect, resource) {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [{
        Action: "execute-api:Invoke",
        Effect: effect,
        Resource: resource
      }],
    },
  };
}

export const handler = async (event) => {
  try {
    console.log("Auth request:", JSON.stringify(event, null, 2));

    const token = event.queryStringParameters?.assertion;
    if (!token ) {
      throw new Error("Missing token");
    }

    const decoded = jwt.decode(token, { complete: true });
    console.log("Decoded JWT:", JSON.stringify(decoded, null, 2));
    if (!decoded || !decoded.header || !decoded.header.kid) {
      throw new Error("Invalid JWT structure");
    }

    const publicKey = await getSigningKey(decoded.header.kid);

    console.log("Public key:", publicKey);

    const claims = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer,
      audience: expectedAudience,
    });

    return generatePolicy(claims.sub, "Allow", event.methodArn);

  } catch (err) {
    console.error("Authorization error:", err.message);
    return generatePolicy("anonymous", "Deny", event.methodArn);
  }
};
