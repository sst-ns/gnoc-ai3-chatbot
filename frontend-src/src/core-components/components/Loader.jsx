import { Backdrop, CircularProgress } from "@mui/material";

const Loader = (props) => {
  return (
    <Backdrop
      open={props?.open}
      sx={{
        color: "#fff",
        pointerEvents: "none !important",
        width: props?.width,
        left: props?.left,
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <CircularProgress
        color="inherit"
        sx={{
          width: "50px !important",
          height: "50px !important",
        }}
      />
    </Backdrop>
  );
};

export default Loader;
