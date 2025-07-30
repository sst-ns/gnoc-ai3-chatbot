import {
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";

const TableToolbar = () => {
  return (
    <GridToolbarContainer
      sx={{
        justifyContent: "space-between",
        padding: "0.5rem 1rem",
      }}
    >
      <GridToolbarQuickFilter />
      <GridToolbarExport
        printOptions={{ disableToolbarButton: true }}
        sx={{ fontWeight: "bold", fontSize: "14px" }}
      />
    </GridToolbarContainer>
  );
};

export default TableToolbar;
