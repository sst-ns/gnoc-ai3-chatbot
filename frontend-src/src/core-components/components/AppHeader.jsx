import { Logout, Menu as MenuIcon } from "@mui/icons-material";
import {
  Toolbar,
  AppBar,
  IconButton,
  Typography,
  Grid,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  Box
} from "@mui/material";
import { useState } from "react";
import AccentureLogo from "../../assets/logos/accenture-logo.png";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

function stringToColor(string) {
  let hash = 0,
    i,
    color = "#";

  for (i = 0; i < string?.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }

  return color;
}

function stringAvatar(name) {
  return {
    sx: {
      bgcolor: stringToColor(name),
    },
    children: `${name?.split(" ")[0][0]}${name?.split(" ")[1][0]}`,
  };
}

const AppHeader = (props) => {
  const { user } = props;
  const [open, setValue] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const navigate = useNavigate();

  let userArr = [
    { label: "User", value: user.name },
    { label: "EnterpriseID", value: user.email.split("@")[0] },
    { label: "Role", value: user.role },
  ];

  const handleClick = (event, type, logout) => {
    setAnchorEl(type === "close" ? null : event.currentTarget);
    if (logout) {
      Swal.fire({
        title: "Are you sure?",
        text: "You will be logged out from the application.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, log out",
        cancelButtonText: "No, cancel!",
      }).then((result) => {
        if (result.isConfirmed) {
          window.sessionStorage.clear();
          window.location.href =
            "https://securitydashboard.auth.us-east-1.amazoncognito.com/oauth2/authorize?client_id=57m7hck10v7f64ahes95cejk2v&response_type=token&scope=email+openid+profile&redirect_uri=https%3A%2F%2Fprod.d1jwklogwk2cxr.amplifyapp.com";
        }
      });
    }
  };

  const handleDrawerToggle = () => {
    props.hamburgerClicked(!open);
    setValue(!open);
  };

  return (
    <AppBar
      component="nav"
      className="app-header"
      style={{ width: open ? "calc(100% - 15.3rem)" : "100%" }}
    >
      <Toolbar>
        <Grid container direction="row" justifyContent="space-between">
          <Grid item xs={7} display="flex" alignItems="center">
            <IconButton
              color="inherit"
              onClick={handleDrawerToggle}
              sx={{
                mr: 2,
              }}
            >
              <MenuIcon />
            </IconButton>
            <img src={AccentureLogo} className="acc-logo" />
          </Grid>

          <Grid
            item
            xs={5}
            display="flex"
            columnGap={2}
            alignItems="center"
            justifyContent="end"
          >
            <Typography display="grid" textAlign="end" fontSize={18}>
                Artificial Intelligent Incident Insight
            </Typography>
            <IconButton
              onClick={handleClick}
              size="small"
              aria-controls={menuOpen ? "account-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={menuOpen ? "true" : undefined}
            >
              <Avatar {...stringAvatar(user.name)} />
            </IconButton>
          </Grid>
        </Grid>

        <Menu
          anchorEl={anchorEl}
          id="account-menu"
          className="acc-menu"
          transformOrigin={{ horizontal: "right", vertical: "top" }}
          anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          slotProps={{
            paper: {
              elevation: 0,
              sx: {
                overflow: "visible",
                filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.32))",
                mt: 1.5,
                "& .MuiAvatar-root": {
                  width: 32,
                  height: 32,
                  ml: -0.5,
                  mr: 1,
                },
                "&::before": {
                  content: '""',
                  display: "block",
                  position: "absolute",
                  top: 0,
                  right: 14,
                  width: 10,
                  height: 10,
                  bgcolor: "background.paper",
                  transform: "translateY(-50%) rotate(45deg)",
                  zIndex: 0,
                },
              },
            },
          }}
          open={menuOpen}
          onClose={($event) => {
            handleClick($event, "close");
          }}
          onClick={($event) => {
            handleClick($event, "close");
          }}
        >
          <Box
            sx={{
              wordBreak: "break-all",
              padding: "0.5rem",
            }}
          >
            {userArr.map((el, i) => {
              return (
                <div key={i}>
                  <label>{el.label}: </label>
                  <span style={{ fontWeight: "bold", marginLeft: "8px" }}>
                    {el.value}
                  </span>
                </div>
              );
            })}
          </Box>
          <Divider />

          <MenuItem
            onClick={($event) => {
              handleClick($event, "close", true);
            }}
          >
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
