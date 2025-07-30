import { VulnerabilityOverview, Users, Logs, TestAdmin } from "./views/index";
import { useContext } from "react";
import { Context } from "./core-components/components/AppLayout";

const AppRouting = () => {
  const { context } = useContext(Context);

  let arr = [
    {
      path: "/",
      name: "Overview",
      element: VulnerabilityOverview,
      exact: true,
      authenticated: true,
    },
    {
      path: "/overview",
      name: "Overview",
      element: VulnerabilityOverview,
      authenticated: true,
    },
    {
      path: "/users",
      name: "Users",
      element: Users,
      authenticated: context.Role !== "User",
    },
    {
      path: "/logs",
      name: "Logs",
      element: Logs,
      authenticated: context.Role !== "User" && context.Role !== "BillingPOC",
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
