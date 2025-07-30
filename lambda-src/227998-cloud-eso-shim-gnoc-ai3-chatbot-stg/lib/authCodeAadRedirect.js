var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const configV2 = {
    /**
     *
     *  Variables are decorated by lambda@edge with reference data from env.json
     */
    auth: {
        clientId: '{{CLIENT_ID}}',
        redirectUri: 'https://{{DOMAIN}}/',
        authority: 'https://login.microsoftonline.com/{{AUTHORITY}}',
    },
};
const msalInstance = new msal.PublicClientApplication(configV2);
const silentRequest = {
    loginHint: 'default',
    scopes: ['openid'],
};
// Redirect: once login is successful and redirects with tokens, call downstream
msalInstance.initialize().then(() => {
    msalInstance
        .handleRedirectPromise()
        .then(handleResponseV2)
        .catch((err) => {
        console.error(err);
    });
});
const loginRequest = {
    scopes: ['openid'],
};
// https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/aa50c51cd3cf9a1780fcfc4f0728ca0fcef0310c/samples/msal-browser-samples/VanillaJSTestApp2.0/app/ssoSilent/auth.js#L27
function handleResponseV2(resp) {
    return __awaiter(this, void 0, void 0, function* () {
        const isInIframe = window.parent !== window;
        if (!isInIframe) {
            if (resp !== null) {
                // resp indicates there is a valid session -- request an accessToken for the scope
                silentRequest.loginHint = resp.account.username;
                const response = yield getTokenRedirect(loginRequest, resp.account);
                // we have an Access Token for our custom API make the request.
                requestSecureCookies(response.idToken);
            }
            else {
                try {
                    // uncertain if there is a valid session, attempt to access it from MSAL API
                    yield msalInstance.ssoSilent(silentRequest);
                    const currentAccounts = msalInstance.getAllAccounts();
                    silentRequest.loginHint = currentAccounts[0].username;
                    // there *is* a valid session -- request an accessToken for the scope
                    const response = yield getTokenRedirect(loginRequest, currentAccounts[0]);
                    // we have an Access Token for our custom API make the request.
                    requestSecureCookies(response.idToken);
                }
                catch (error) {
                    console.error(error);
                    // there *is not*  a valid session -- redirect to the login flow
                    return msalInstance.loginRedirect(loginRequest);
                }
            }
        }
    });
}
// https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/aa50c51cd3cf9a1780fcfc4f0728ca0fcef0310c/samples/msal-browser-samples/VanillaJSTestApp2.0/app/ssoSilent/auth.js#L84
function getTokenRedirect(request, account) {
    return __awaiter(this, void 0, void 0, function* () {
        request.account = account;
        return yield msalInstance.acquireTokenSilent(request).catch((error) => __awaiter(this, void 0, void 0, function* () {
            if (error instanceof msal.InteractionRequiredAuthError) {
                // fallback to interaction when silent call fails
                console.log('acquiring token using redirect');
                msalInstance.acquireTokenRedirect(request);
            }
            else {
                console.error(error);
            }
        }));
    });
}
/**
 * requestSecureCookies takes an access token with the scope `User.Read`.
 * the expected result from this xhr request is a 302 redirect with CloudFront Cookies/Policy/Expiry as Set-Cookies
 */
const requestSecureCookies = function (token) {
    const xhr = new XMLHttpRequest();
    // Setup our listener to process completed requests
    xhr.onload = function () {
        console.log('Got response', xhr.status);
        if (xhr.status == 200) {
            /* cached? */ location.reload();
        }
    };
    xhr.onerror = function () {
        console.warn('caught error');
    };
    xhr.onabort = function () {
        console.log('aborted ');
    };
    xhr.open('GET', `{{PATH}}`);
    xhr.setRequestHeader(`{{HEADER}}`, token);
    xhr.send();
};
