import {
  List,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Drawer,
  Collapse,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import SideMenuList from "../configs/SideMenuList";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SecLogo from "../../assets/logos/sard.png";
import AiLogo from "../../assets/logos/ai3logo.png";

let menuList = SideMenuList;

const AppSideNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [sideMenuList, setList] = useState(menuList);

  const handleClick = (index) => {
    if (!isNaN(index) && sideMenuList[index]?.open !== undefined) {
      let row = [...sideMenuList];
      row[index].open = !row[index].open;
      setList(row);
    } else if (index?.path) {
      navigate(index.path);
    }
  };

  const MenuList = ({ list }) => {
    return (
      <List key={list.length}>
        {list.map((text, index) => {
          return (
            <>
              <ListItemButton
                key={text.id}
                sx={{
                  minHeight: 48,
                  justifyContent: "center",
                  m: 1,
                  borderRadius: "5px",
                  background: location.pathname.includes(text?.path)
                    ? "#212a55"
                    : "transparent",
                  color: location.pathname.includes(text?.path)
                    ? "#fff"
                    : "#000",
                  pl: text?.id?.includes("child") ? 5 : 0,
                  "&.MuiButtonBase-root:hover": {
                    color: "#fff",
                    bgcolor: "#212a55",
                  },
                  borderBottom: text?.id?.includes("parent")
                    ? "2px solid black"
                    : "",
                  display: text?.show ? "flex" : "none",
                }}
                onClick={() => {
                  handleClick(text);
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 2,
                    ml: 1,
                    color: "inherit",
                  }}
                >
                  <text.icon />
                </ListItemIcon>
                <ListItemText primary={text.menu} />

                {text?.children && (
                  <IconButton
                    onClick={() => {
                      handleClick(index);
                    }}
                    sx={{
                      color: "inherit",
                    }}
                  >
                    {text?.open ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                )}
              </ListItemButton>

              <Collapse
                key={index}
                sx={{ background: "#fff" }}
                in={text?.open}
                timeout="auto"
                unmountOnExit
              >
                {text?.children && <MenuList list={text.children} />}
              </Collapse>
            </>
          );
        })}
      </List>
    );
  };

  return (
    <Drawer
      className="app-sidenav"
      variant="permanent"
      sx={{
        width: "15rem",
      }}
    >
      {/* <Typography className="app-title" margin={2} fontWeight={600}>
        SARD
      </Typography> */}
      {/* <img src={SecLogo} className="sec-logo" /> */}
      <img src={AiLogo} className="sec-logo" />

      <Divider />

      <MenuList list={sideMenuList} />
    </Drawer>
  );
};

export default AppSideNav;
