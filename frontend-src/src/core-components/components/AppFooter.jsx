import { Toolbar, AppBar, Typography, Grid } from "@mui/material";

const AppFooter = (props) => {
  return (
    <AppBar
      component="nav"
      className="app-footer"
      style={{
        width: props.menuOpened ? "calc(100% - 15.3rem)" : "100%",
        marginLeft: props.menuOpened ? "15.3rem" : "0px",
      }}
    >
      <Toolbar>
        <Grid
          container
          direction="row"
          alignItems="center"
          justifyContent="center"
        >
          <Typography display="flex" alignItems="baseline">
            Copyright 2025 Accenture. All rights reserved. Accenture
            Confidential. For internal use only.
          </Typography>
        </Grid>
      </Toolbar>
    </AppBar>
  );
};

export default AppFooter;
