// import React from "react";
// import ReactDOM from "react-dom/client";
// import App from "./App.jsx";
// import "./index.scss";
// import "./table.scss"
// import { ThemeProvider, createTheme } from "@mui/material/styles";

// const theme = createTheme({
//   palette: {
//     primary: {
//       main: "#212a55", //422e79
//     },
//     secondary: {
//       main: "#00fff0",
//     },
//   },
// });

// ReactDOM.createRoot(document.getElementById("root")).render(
//   // <React.StrictMode>
//   <ThemeProvider theme={theme}>
//     <App />
//   </ThemeProvider>
//   // </React.StrictMode>
// );

// // import { PublicClientApplication } from "@azure/msal-browser";
// // import { MsalProvider } from "@azure/msal-react";
// // import { msalConfig } from "../msalConfig.js";

// // const msalInstance = new PublicClientApplication(msalConfig);

// // ReactDOM.createRoot(document.getElementById('root')).render(
// //   <React.StrictMode>
// //     <MsalProvider instance={msalInstance}>
// //       <App />
// //     </MsalProvider>
// //   </React.StrictMode>
// // );

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.scss";
import "./table.scss"
import { ThemeProvider, createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#212a55", //422e79
    },
    secondary: {
      main: "#00fff0",
    },
  },
});

// ReactDOM.createRoot(document.getElementById("root")).render(
//   // <React.StrictMode>
//   <ThemeProvider theme={theme}>
//     <App />
//   </ThemeProvider>
//   // </React.StrictMode>
// );

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "../msalConfig.js";

const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize()
  .then(() => {
    return msalInstance.handleRedirectPromise();
  })
  .then((response) => {
    console.log("🔐 Redirect login response:", response);

    const accounts = msalInstance.getAllAccounts();

    if (accounts.length === 0) {
      // No user logged in, trigger login
      console.log("🟡 No account found, initiating login...");
      msalInstance.loginRedirect(); // or loginPopup
      return;
    }

    console.log("✅ User already signed in:", accounts[0]);

    // Now render app
    const root = ReactDOM.createRoot(document.getElementById("root"));
   root.render(
  <MsalProvider instance={msalInstance}>
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  </MsalProvider>
);
  })
  .catch((error) => {
    console.error("❌ Redirect error:", error);
  });
