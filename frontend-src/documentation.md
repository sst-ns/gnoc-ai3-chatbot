# Frontend Documentation

## 1. Project Overview

This project, "Artificial Intelligent Incident Insight," is a web application designed for vulnerability management. It provides a user-friendly interface for visualizing incident data, managing files, and interacting with an AI-powered chatbot.

The application is built as a single-page application (SPA) using **React** and **Vite**. Key features include:

-   **Authentication**: Secure login and access control using Microsoft Authentication Library (MSAL).
-   **Data Visualization**: Interactive charts and graphs for incident trends, powered by **ECharts**.
-   **File Management**: Functionality to upload and process incident-related documents (`.docx`, `.xlsx`).
-   **Real-time Communication**: A **WebSocket**-based service layer for real-time updates on file processing and data fetching.
-   **AI Chatbot**: An interface to "Ask the Bot" for insights and data analysis.
-   **Modern UI**: A responsive and clean user interface built with **Material-UI**.

## 2. Getting Started

To get the frontend running locally, follow these steps:

1.  **Navigate to the frontend directory:**
    ```sh
    cd frontend-src
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

3.  **Start the development server:**
    ```sh
    npm run dev
    ```

This will start the Vite development server. You can view the application in your browser at the local address provided (usually `http://localhost:5173`).

## 3. Project Structure

The `frontend-src` directory contains all the frontend code and is structured as follows:

-   **`public/`**: Static assets that are copied directly to the build output. Contains the `accenture-icon.png`.
-   **`src/`**: The main application source code.
    -   **`assets/`**: Static assets processed by Vite, such as images, logos, and videos.
    -   **`core-components/`**: The fundamental building blocks of the application's layout.
        -   `components/`: Contains the main layout components (`AppHeader`, `AppFooter`, `AppSideNav`).
        -   `configs/`: Configuration for core components, like the side menu structure (`SideMenuList.js`).
        -   `styles/`: SCSS files specific to the core components.
    -   **`reusable-components/`**: Components and hooks designed to be used across multiple parts of the application.
        -   `customHook/`: Contains custom React hooks, such as `useLogs.js`.
    -   **`services/`**: Handles all external communication, primarily the API and WebSocket interactions.
    -   **`utils/`**: Utility functions that can be used anywhere in the application (e.g., `getCookie.js`).
    -   **`views/`**: Components that represent the main pages or "views" of the application.
        -   `components/`: The main view components (`VulnerabilityOverview`, `Users`, `Logs`).
        -   `popups/`: Dialog/modal components used within the views.
        -   `styles/`: SCSS files specific to the views.
-   **Configuration Files**:
    -   `.eslintrc.cjs`: ESLint configuration for code quality and style.
    -   `vite.config.js`: Vite build and development server configuration.
    -   `package.json`: Project metadata, dependencies, and scripts.
    -   `msalConfig.js`: Configuration for the Microsoft Authentication Library (MSAL).

## 4. Configuration

-   **Vite (`vite.config.js`)**: The configuration includes the `define: {global: 'window'}` setting, which is a workaround to make certain libraries that expect a `global` object (common in Node.js) compatible with the browser environment by aliasing `global` to `window`.

-   **ESLint (`.eslintrc.cjs`)**: The project uses ESLint with recommended rule sets for ESLint, React (`plugin:react/recommended`), React JSX runtime, and React Hooks to enforce code quality and consistency.

-   **MSAL (`msalConfig.js`)**: This file is crucial for authentication. It defines:
    -   `auth.clientId`: The application (client) ID from Azure AD.
    -   `auth.authority`: The Azure AD tenant URL for authentication.
    -   `auth.redirectUri`: The URL where the user is redirected after a successful login.
    -   `cache.cacheLocation`: Configured to use `sessionStorage` to store authentication state.
    -   `loginRequest.scopes`: Defines the permissions the application requests from the Microsoft Graph API (e.g., `User.Read`).

## 5. Application Flow & Routing

1.  **Initialization (`main.jsx`)**: The application entry point initializes the MSAL `PublicClientApplication`. It then attempts to handle any redirect responses from a login flow. If no user is logged in, it triggers a login redirect. Once a user is authenticated, the main `App` component is rendered within the `MsalProvider` and a Material-UI `ThemeProvider`.

2.  **Root Component (`App.jsx`)**: This component sets up the main application router using `BrowserRouter`. It uses a `Suspense` boundary to show a `Loader` while the main `AppLayout` component and its children are being lazy-loaded.

3.  **Routing (`AppRouting.js`)**: This file exports an array of route objects. Each object defines a `path`, the `element` (component) to render, and an `authenticated` flag. The `authenticated` flag uses the shared `Context` to conditionally render routes based on the user's role (e.g., some routes are hidden for users with the "User" role).

4.  **Layout (`AppLayout.jsx`)**: This component establishes the main visual structure. It creates a `Context` to share application-wide state. It renders the `AppHeader`, `AppSideNav`, and `AppContent` components and manages the visibility of the side navigation.

5.  **Content (`AppContent.jsx`)**: This component renders the appropriate view component based on the current URL, using the routes defined in `AppRouting.js`.

## 6. Component Deep Dive

### Core Components

-   **`AppHeader.jsx`**: Displays the top navigation bar. It includes the hamburger menu icon to toggle the `AppSideNav`, the Accenture logo, the application title, and a user profile avatar. Clicking the avatar opens a menu with user details (Name, EnterpriseID, Role) and a logout button.
-   **`AppSideNav.jsx`**: The left-hand navigation menu. It dynamically generates menu items from `SideMenuList.js`. It uses the `useLocation` hook from `react-router-dom` to highlight the currently active page.
-   **`VulnerabilityOverview.jsx`**: The main dashboard view. It displays several charts from **ECharts** showing incident trends by month, average resolution time, and RCA counts. It includes filters to view data by year.
-   **`Users.jsx`**: This view is for file management. It provides a dialog for users to select a file (`.docx` or `.xlsx`) and enter associated metadata (Category, Subcategory, RCA Link, etc.) before uploading. It shows the status and progress of the upload and extraction process.
-   **`Logs.jsx`**: This component provides the "Ask the Bot" chatbot interface. It maintains the chat history in its state, handles user input, and calls the `sendChatMessageToBackend` service. It is responsible for rendering the bot's text and image responses, including securely fetching images that require an auth token.

### Services (`services/api.js`)

This file is the communication hub for the frontend.

-   **`connectWebSocket(accessToken)`**: Initializes the WebSocket connection to the backend, appending the user's access token to the URL for authentication.
-   **Event Listeners**: A set of functions (`listenFor...`) that allow components to subscribe to different WebSocket events:
    -   `listenForProgress`: Receives real-time progress updates during file extraction.
    -   `listenForExtraction`: Receives the final extracted data once processing is complete.
    -   `listenForFetch`: Receives data for incidents and charts.
    -   `listenForAutoReset`: A listener to reset the UI state after an operation.
-   **Request Functions**:
    -   `sendUploadRequest(file, metadata)`: Initiates the file upload process by sending an `upload` action to the WebSocket.
    -   `sendExtractRequest(key)` / `sendExcelRequest(key)`: Sent after a file is successfully uploaded to S3 to trigger the backend extraction process.
    -   `sendDeleteRequest(incidentNumber)`: Sends a `delete` action to remove an incident record.
    -   `sendChatMessageToBackend(userMessage, instance)`: The core function for the chatbot. It acquires a fresh MSAL token, calls the backend ATA lambda with the user's message, and then performs complex parsing on the response to separate the text reply from any function call-generated images.

## 7. Key Dependencies

-   **`@azure/msal-browser` & `@azure/msal-react`**: For handling authentication against Azure Active Directory.
-   **`@mui/material` & `@mui/icons-material`**: A comprehensive UI component library for building the user interface.
-   **`@mui/x-data-grid`**: A powerful data grid component used for displaying tabular data.
-   **`echarts` & `echarts-for-react`**: For creating interactive and customizable charts.
-   **`axios`**: Used for making HTTP requests, particularly for uploading files to S3 pre-signed URLs.
-   **`react-router-dom`**: For handling client-side routing.
-   **`sass`**: For writing styles in SCSS.
-   **`vite`**: The build tool and development server.