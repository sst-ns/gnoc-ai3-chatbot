import { Toolbar, AppBar, Typography, Grid, Link } from "@mui/material";

const AppFooter = (props) => {
  return (
    <AppBar
      component="nav"
      className="app-footer"
      style={{
        width: props.menuOpened ? "calc(100% - 15.3rem)" : "100%",
        marginLeft: props.menuOpened ? "15.3rem" : "0px",
        backgroundColor: "#fff", // optional: for contrast
        color: "#fff", // optional: for readability
        padding: "0.5rem 0",
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
            Copyright 2001-2025 Accenture. All rights reserved. Accenture Highly Confidential. For internal use only &nbsp;|&nbsp;
            <Link
              href="https://support.accenture.com/support_portal?id=sp_acn_4_0_terms_of_use"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: "rgba(var(--bs-link-color-rgb), var(--bs-link-opacity, 1))",
                textDecoration: "underline",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              Terms of Use
            </Link>
          </Typography>
        </Grid>
      </Toolbar>
    </AppBar>
  );
};

export default AppFooter;
