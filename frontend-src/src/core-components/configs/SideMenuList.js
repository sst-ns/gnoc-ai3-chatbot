import {
  PersonAdd,
  History,
  Home,
  Dashboard,
  VerifiedUserSharp,
  CloudUpload,  // New icon for Upload Files
  Chat,       
} from "@mui/icons-material";
import { useContext } from "react";
import { Context } from "../components/AppLayout";

const SideMenuList = () => {
  const { context } = useContext(Context);

  let arr = [
    {
      menu: "Home",
      icon: Home,
      id: "parent1",
      open: true,
      show: true,
      children: [
        {
          menu: "Dashboard",
          icon: Dashboard,
          path: "/dashboard",
          id: "child1",
          show: true,
        },
         {
          menu: "Ask The Bot",
          icon: Chat,
          path: "/chatbot",
          id: "child3",
          show: context.Role !== "User" && context.Role !== "BillingPOC",
        },
        {
          menu: "Upload Files",
          icon: CloudUpload,
          path: "/upload",
          id: "child2",
          show: context.Role !== "User",
        },
        // {
        //   menu: "Test Admin",
        //   icon: VerifiedUserSharp,
        //   path: "/testadmin",
        //   id: "child4",
        //   show: true,
        // },
      ],
    },
  ];
  return arr;
};

export default SideMenuList;
