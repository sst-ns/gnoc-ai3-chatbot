import { VulnerabilityOverview, Users, Logs, TestAdmin } from "./views/index";
import { useContext } from "react";
import { Context } from "./core-components/components/AppLayout";

const AppRouting = () => {
  const { context } = useContext(Context);

  let arr = [
    {
      path: "/",
      name: "Dashboard",
      element: VulnerabilityOverview,
      exact: true,
      authenticated: true,
    },
    {
      path: "/dashboard",
      name: "Dashboard",
      element: VulnerabilityOverview,
      authenticated: true,
    },
    {
      path: "/upload",
      name: "Upload",
      element: Users,
      authenticated: true,
    },
    {
      path: "/chatbot",
      name: "Chatbot",
      element: Logs,
      authenticated: true,
    },
    {
      path: "/testadmin",
      name: "TestAdmin",
      element: TestAdmin,
      authenticated: true,
    },
  ];
  return arr;
};

export default AppRouting;