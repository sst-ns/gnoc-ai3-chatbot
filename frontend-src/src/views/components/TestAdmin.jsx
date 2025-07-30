import { useContext, useEffect, useState } from "react";
import ApiService from "../../services/api";
import { Context } from "../../core-components/components/AppLayout";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import Swal from "sweetalert2";
import useLogs from "../../reusable-components/customHook/useLogs";

const TestAdmin = () => {
  const { createLog } = useLogs();
  const { context } = useContext(Context);
  const [dataList, setDataList] = useState();
  const [parameterList, setDetails] = useState({
    roles: ["User", "Admin", "BillingPOC"],
    selectedRoles: "",
    entity: [],
    selectedEntity: "",
    sites: [],
    selectedSites: [],
    loading: true,
  });

  let arr = [
    {
      label: "Role",
      state: "roles",
      selectedState: "selectedRoles",
      show: true,
    },
    {
      label: "Entity",
      state: "entity",
      selectedState: "selectedEntity",
      show: parameterList.selectedRoles !== "Admin",
    },
    {
      label: "Sites",
      state: "sites",
      selectedState: "selectedSites",
      multiple: true,
      show: parameterList.selectedRoles !== "Admin",
    },
  ];

  useEffect(() => {
    callAPI({
      Action: "entitysiteid",
      Entity: context.Entity,
      Role: "Admin",
      SiteID: context.SiteID,
    });
  }, []);

  const callAPI = async (payload) => {
    let { body } = await ApiService(payload, "users");
    body = typeof body == "string" ? JSON.parse(body) : body;
    if (body.length) {
      let entity = [];
      body.forEach((el) => {
        entity.push(el.Entity);
      });

      setDetails((prev) => ({
        ...prev,
        entity,
        loading: false,
      }));
    }
    setDataList(body);
  };

  const handleChange = (el, event) => {
    let sites = [];
    if (el.label === "Entity") {
      sites = dataList.find((e) => e.Entity === event.target.value).SiteID;
      setDetails((prev) => ({
        ...prev,
        sites: sites,
      }));
    }
    setDetails((prev) => ({
      ...prev,
      [el.selectedState]: event.target.value,
    }));
  };

  const handleSubmit = async () => {
    let payload = {
      Action: "testuser",
      EnterpriseID: context.EnterpriseID,
      SiteID: parameterList.selectedSites,
      Entity: parameterList.selectedEntity,
      Role: parameterList.selectedRoles,
    };
    let { body } = await ApiService(payload, "users");
    if (body === "Success") {
      let action =
        parameterList.selectedRoles === "Admin"
          ? ""
          : `, Entity to ${payload.Entity} and Sites to ${payload.SiteID}`;

      await createLog({
        user: context.EnterpriseID,
        role: context.Role,
        entity: context.Entity,
        action:
          `${context.EnterpriseID} has changed his/her Role to ${payload.Role}` +
          action,
        status: "Successfully Changed",
      });
      showMessage(body, "success");
      window.location.reload();
    } else {
      showMessage(body, "error");
    }
  };

  const showMessage = (body, type) => {
    Swal.fire({
      title: body,
      text: type,
      icon: type,
      confirmButtonText: "Ok",
    });
  };
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        rowGap: "2rem",
        marginTop: "1rem",
      }}
    >
      <Box sx={{ display: "flex", columnGap: "2rem" }}>
        {arr.map((el, i) => {
          return (
            <FormControl
              fullWidth
              key={i}
              sx={{
                visibility: el.show ? "visible" : "hidden",
              }}
            >
              <InputLabel id={el.state + "-simple-select-label"}>
                {el.label}
              </InputLabel>
              <Select
                multiple={el?.multiple}
                defaultValue=""
                labelId={el.state + "-simple-select-label"}
                id={el.state + "-simple-select"}
                value={parameterList?.[el?.selectedState]}
                label={el?.label}
                onChange={($event) => {
                  handleChange(el, $event);
                }}
              >
                {el.state === "entity" && parameterList.loading ? (
                  <MenuItem value="" disabled>
                    Loading Entities....
                  </MenuItem>
                ) : (
                  parameterList?.[el.state]?.map((element, index) => {
                    return (
                      <MenuItem key={index} value={element}>
                        {element}
                      </MenuItem>
                    );
                  })
                )}
              </Select>
            </FormControl>
          );
        })}
      </Box>

      <Button
        variant="contained"
        sx={{ width: "fit-content" }}
        onClick={handleSubmit}
      >
        Submit
      </Button>
    </Box>
  );
};

export default TestAdmin;
