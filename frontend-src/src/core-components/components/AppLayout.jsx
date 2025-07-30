import { AppHeader, AppFooter, AppContent, Loader } from "../index";
import "../styles/index.scss";
import AppSideNav from "./AppSideNav";
import { useState, useEffect, createContext } from "react";
import { Box } from "@mui/material";

export const Context = createContext();

const AppLayout = () => {
  const [context, setContext] = useState({});
  const [showSideNav, setValue] = useState(true);
  const [user, setUserName] = useState({
    name: "Test User",
    email: "test.user@accenture.com",
    role: "",
  });

  const menuClicked = (event) => {
    setValue(event);
  };

  useEffect(() => {
    setContext({});
  }, []);

  return (
    <div className="layout-page">
      <Context.Provider value={{ context }}>
        <Box component="main" sx={{ display: "flex" }}>
          <AppHeader user={user} hamburgerClicked={menuClicked} />
          {showSideNav ? <AppSideNav /> : null}
          <AppContent userName={user.email} menuOpened={showSideNav} />
        </Box>
        <AppFooter menuOpened={showSideNav} />
      </Context.Provider>
    </div>
  );
};

export default AppLayout;
