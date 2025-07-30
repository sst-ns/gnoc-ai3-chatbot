// msalConfig.js
export const msalConfig = {
  auth: {
    clientId: "aa100a74-2e5a-4ff8-a30f-bd598a3eb18b",
    authority: "https://login.microsoftonline.com/f3211d0e-125b-42c3-86db-322b19a65a22",  //tenant id
    redirectUri: "https://d2qf9kul80tj8l.cloudfront.net", // or your deployed URL  https://d3plip1w1t2y70.cloudfront.net
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ["User.Read"] // Needed to fetch group membership
};
