import { Close, ExpandMore, Search } from "@mui/icons-material";
import {
  DialogTitle,
  Dialog,
  DialogContent,
  Typography,
  IconButton,
  DialogActions,
  Button,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormControl,
  OutlinedInput,
  Select,
  Checkbox,
  InputLabel,
  MenuItem,
  Tabs,
  Tab,
  Box,
  FormGroup,
  FormLabel,
  AccordionSummary,
  Accordion,
  AccordionDetails,
  Pagination,
  TextField,
  InputAdornment,
} from "@mui/material";
import { useEffect, useState, useContext } from "react";
import { dateIntervals, viewList, graphTypes } from "../data/helper";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import ApiService from "../../services/api";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import moment from "moment";
import { Context } from "../../core-components/components/AppLayout";
import { styles } from "../styles/Style";
import { Loader } from "../../core-components";

const VunerabilityConfig = (props) => {
  const { onClose, open } = props;
  const { context } = useContext(Context);
  const [configPopupData, setValue] = useState({
    timeRange: {
      startDate: moment(),
      endDate: moment(),
    },
    selectedInterval: "Daily",
    selectedView: "Summary",
    selectedGraph: [],
    selectedTab: 0,
    policyList: [],
    filteredPolicy: [],
    selectedPolicy: [],
    policyPageCount: 0,
    policyPageNo: 1,
    accountList: context.AccountIDs.slice(
      0,
      context.AccountIDs.length > 10 ? 10 : context.AccountIDs.length
    ),
    selectedAccounts: [],
    accountsPageCount:
      Math.trunc(context.AccountIDs.length / 10) +
      (context?.AccountIDs.length % 10 > 0 ? 1 : 0),
    accountsPageNo: 1,
    allPolicySelected: true,
    allAccountsSelected: true,
    loading: true,
  });

  useEffect(() => {
    getData();
  }, []);

  const getData = async () => {
    let request = {
      type: "policylist",
    };
    let { body } = await ApiService(request, "vul");

    if (body.length) {
      setValue((prev) => ({
        ...prev,
        policyList: body,
        loading: false,

        filteredPolicy: body.slice(0, body.length > 10 ? 10 : body.length),
        policyPageCount:
          Math.trunc(body.length / 10) + (body.length % 10 > 0 ? 1 : 0),
      }));
    }
  };

  const resetState = () => {
    setValue({
      timeRange: {
        startDate: moment(),
        endDate: moment(),
      },
      selectedInterval: "Daily",
      selectedView: "Detail",
      selectedTab: 0,
      policyList: [],
      selectedPolicy: [],
      selectedGraph: [],
      selectedAccounts: [],
      accountList: context.AccountIDs.slice(
        0,
        context.AccountIDs.length > 10 ? 10 : context.AccountIDs.length
      ),
      accountsPageCount:
        Math.trunc(context.AccountIDs.length / 10) +
        (context?.AccountIDs.length % 10 > 0 ? 1 : 0),
      accountsPageNo: 1,
      allPolicySelected: true,
      allAccountsSelected: true,
    });
  };

  const setTimeRange = (key, newValue) => {
    setValue((prev) => ({
      ...prev,
      timeRange: { ...prev.timeRange, [key]: newValue },
    }));
  };

  const handleEvents = (type, key, event, element) => {
    if (type === "checkbox") {
      let data = [...configPopupData[key]];

      if (!event.target.checked) {
        data.splice(data.indexOf(element), 1);
      }

      if (
        key === "selectedPolicy" &&
        configPopupData.selectedGraph.includes("Detection Trend View")
      ) {
        if (configPopupData.selectedPolicy.length < 5 && event.target.checked) {
          data.push(element);
        }
      } else {
        if (event.target.checked) {
          data.push(element);
        }
      }

      if (key === "selectedGraph") {
        if (data.includes("Detection Trend View")) {
          setValue((prev) => ({
            ...prev,
            allPolicySelected: false,
          }));
        }
      }
      setValue((prev) => ({
        ...prev,
        [key]: data,
      }));
    } else {
      if (type === "radio") {
        setValue((prev) => ({
          ...prev,
          selectedPolicy: [],
          selectedGraph: [],
          selectedAccounts: [],
          allPolicySelected: true,
          allAccountsSelected: true,
        }));
      }

      setValue((prev) => ({
        ...prev,
        [key]: event,
      }));
    }
  };

  const handleAccountsEvents = (field, event) => {
    let accList = structuredClone(context.AccountIDs);
    let filteredAcc = [];
    if (field === "accountSearchText") {
      filteredAcc = accList.filter((el) => el.includes(event));
    } else {
      let firstIndex = event * 10 - 10;
      let nextIndex = event * 10;
      let lastIndex = accList.length;
      filteredAcc = accList.slice(
        firstIndex,
        lastIndex < nextIndex ? lastIndex : nextIndex
      );
      setValue((prev) => ({
        ...prev,
        accountsPageNo: event,
      }));
    }

    setValue((prev) => ({
      ...prev,
      accountList: filteredAcc,
    }));
  };

  const handlePolicyEvents = (field, event) => {
    let policyList = structuredClone(configPopupData.policyList);
    let data = [];
    if (field === "policySearchText") {
      data = policyList.filter((el) => el.includes(event));
    } else {
      let firstIndex = event * 10 - 10;
      let nextIndex = event * 10;
      let lastIndex = policyList.length;
      data = policyList.slice(
        firstIndex,
        lastIndex < nextIndex ? lastIndex : nextIndex
      );
      setValue((prev) => ({
        ...prev,
        policyPageNo: event,
      }));
    }

    setValue((prev) => ({
      ...prev,
      filteredPolicy: data,
    }));
  };

  const setChecboxVal = (event, field) => {
    if (event.target.checked) {
      if (field === "allAccountsSelected") {
        setValue((prev) => ({
          ...prev,
          selectedAccounts: [],
        }));
      } else {
        setValue((prev) => ({
          ...prev,
          selectedPolicy: [],
        }));
      }
    }
    setValue((prev) => ({
      ...prev,
      [field]: event.target.checked,
    }));
  };

  return (
    <Dialog
      disableEscapeKeyDown={true}
      open={open}
      className="vul-config-popup"
    >
      <DialogTitle
        display={"flex"}
        justifyContent={"space-between"}
        alignItems={"center"}
        boxShadow={"0px 0px 3px 2px lightgray"}
      >
        <Typography>New View </Typography>
        <IconButton
          onClick={() => {
            resetState();
            onClose("");
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      {configPopupData.loading ? (
        <Loader open={configPopupData.loading} width="100vw" />
      ) : (
        <DialogContent sx={{ margin: "1rem 0.2rem" }}>
          <Tabs
            onChange={($event, newVal) => {
              handleEvents("tab", "selectedTab", newVal);
            }}
            value={configPopupData.selectedTab}
            sx={{
              borderBottom: "1px solid #ccd1e4",
              position: "fixed",
              zIndex: "111",
              background: "#fff",
              width: "57vw",
            }}
          >
            <Tab label="Interval and Time range" value={0}></Tab>
            <Tab label="Metrics" value={1}></Tab>
          </Tabs>

          <Box
            sx={{ padding: "1.5rem 0rem 0rem", marginTop: "3rem" }}
            variant="outlined"
          >
            {configPopupData.selectedTab === 0 ? (
              <Box display="grid" gap="1rem">
                <FormControl sx={{ m: 1, width: 300 }}>
                  <InputLabel>Time Interval</InputLabel>

                  <Select
                    value={configPopupData?.selectedInterval}
                    onChange={($event) =>
                      handleEvents(
                        "dropdown",
                        "selectedInterval",
                        $event.target.value
                      )
                    }
                    input={<OutlinedInput label="Time Interval" />}
                  >
                    {dateIntervals?.map((interval) => (
                      <MenuItem key={interval} value={interval}>
                        {interval}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel
                    sx={{
                      fontWeight: "bold",
                      color: "#000",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Time Range
                  </FormLabel>
                  <LocalizationProvider dateAdapter={AdapterMoment}>
                    <DemoContainer components={["DatePicker", "DatePicker"]}>
                      <DatePicker
                        label="Start Date"
                        disableFuture
                        value={configPopupData.timeRange.startDate}
                        onChange={(newValue) =>
                          setTimeRange("startDate", newValue)
                        }
                        maxDate={configPopupData.timeRange.endDate}
                      />
                      <DatePicker
                        disableFuture
                        label="End Date"
                        value={configPopupData.timeRange.endDate}
                        onChange={(newValue) =>
                          setTimeRange("endDate", newValue)
                        }
                        minDate={configPopupData.timeRange.startDate}
                      />
                    </DemoContainer>
                  </LocalizationProvider>
                </FormControl>
              </Box>
            ) : (
              <Box display="grid" gap="1rem">
                <FormControl>
                  <FormLabel sx={{ fontWeight: "bold", color: "#000" }}>
                    Please select View Type
                  </FormLabel>
                  <RadioGroup
                    row
                    value={configPopupData.selectedView}
                    onChange={($event) =>
                      handleEvents("radio", "selectedView", $event.target.value)
                    }
                  >
                    {viewList.map((el, i) => {
                      return (
                        <FormControlLabel
                          key={i}
                          value={el}
                          control={<Radio />}
                          label={el}
                          sx={{
                            display:
                              (context.Role === "User" ||
                                context.Role === "BillingPOC") &&
                              el === "Detail"
                                ? "none"
                                : "flex",
                          }}
                        />
                      );
                    })}
                  </RadioGroup>
                </FormControl>

                {configPopupData.selectedView === "Graph" && (
                  <FormGroup row>
                    {graphTypes.map((el, i) => {
                      return (
                        <FormControlLabel
                          key={i}
                          control={
                            <Checkbox
                              checked={configPopupData.selectedGraph.includes(
                                el
                              )}
                              onChange={($event) =>
                                handleEvents(
                                  "checkbox",
                                  "selectedGraph",
                                  $event,
                                  el
                                )
                              }
                            />
                          }
                          label={el}
                        />
                      );
                    })}
                  </FormGroup>
                )}

                {context?.AccountIDs && (
                  <Accordion>
                    <AccordionSummary
                      sx={{
                        fontWeight: "bold",
                        color: "#000",
                        marginBottom: "0.5rem",
                      }}
                      expandIcon={<ExpandMore />}
                      aria-controls="panel1-content"
                      id="panel1-header"
                    >
                      Account List
                    </AccordionSummary>
                    <AccordionDetails
                      sx={{
                        borderTop: "1px solid lightgray",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "0.5rem 0.5rem 1rem",
                        }}
                      >
                        <TextField
                          id="filled-search"
                          placeholder="Search Accounts"
                          type="text"
                          variant="filled"
                          FormHelperTextProps={{ style: styles.helper }}
                          helperText="Click Search Icon or press Enter to Search"
                          onKeyUp={(e) => {
                            if (e.key === "Enter")
                              handleAccountsEvents(
                                "accountSearchText",
                                document.getElementById("filled-search").value
                              );
                          }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment
                                position="start"
                                sx={{ marginTop: "0px !important" }}
                              >
                                <IconButton
                                  onClick={($event) => {
                                    handleAccountsEvents(
                                      "accountSearchText",
                                      document.getElementById("filled-search")
                                        .value
                                    );
                                  }}
                                  sx={{
                                    padding: "0px",
                                  }}
                                >
                                  <Search />
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                          sx={{
                            input: {
                              padding: "5px",
                              width: "20rem",
                              background: "#fff",
                            },
                          }}
                        />

                        <Pagination
                          onChange={($event, value) => {
                            handleAccountsEvents("accountsPageNo", value);
                          }}
                          page={configPopupData.accountsPageNo}
                          count={configPopupData.accountsPageCount}
                          color="primary"
                        />
                      </Box>

                      <FormControlLabel
                        label="Select All Accounts"
                        control={
                          <Checkbox
                            checked={configPopupData.allAccountsSelected}
                            onChange={($event) => {
                              setChecboxVal($event, "allAccountsSelected");
                            }}
                          />
                        }
                      />

                      {!configPopupData.allAccountsSelected && (
                        <Box
                          sx={{
                            height: "14rem",
                            overflow: "hidden",
                            boxShadow: "0px 0px 3px 0px lightgray",
                            marginTop: "0.5rem",
                            padding: "5px",
                          }}
                        >
                          {configPopupData.accountList.map((el, i) => {
                            return (
                              <FormControlLabel
                                key={i}
                                sx={{
                                  width: "45%",
                                  margin: "2px",
                                }}
                                control={
                                  <Checkbox
                                    checked={configPopupData.selectedAccounts.includes(
                                      el
                                    )}
                                    onChange={($event) =>
                                      handleEvents(
                                        "checkbox",
                                        "selectedAccounts",
                                        $event,
                                        el
                                      )
                                    }
                                  />
                                }
                                label={el}
                              />
                            );
                          })}
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>
                )}

                {configPopupData.policyList.length > 0 &&
                  configPopupData.selectedView !== "Detail" && (
                    <Accordion>
                      <AccordionSummary
                        expandIcon={<ExpandMore />}
                        aria-controls="panel2-content"
                        id="panel2-header"
                        sx={{
                          fontWeight: "bold",
                          color: "#000",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Policy List
                      </AccordionSummary>
                      <AccordionDetails
                        sx={{
                          borderTop: "1px solid lightgray",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "0.5rem 0.5rem 1rem",
                          }}
                        >
                          <TextField
                            id="filled1-search"
                            placeholder="Search Policies"
                            type="text"
                            variant="filled"
                            FormHelperTextProps={{ style: styles.helper }}
                            helperText="Click Search Icon or press Enter to Search"
                            onKeyUp={(e) => {
                              if (e.key === "Enter")
                                handlePolicyEvents(
                                  "policySearchText",
                                  document.getElementById("filled1-search")
                                    .value
                                );
                            }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment
                                  position="start"
                                  sx={{ marginTop: "0px !important" }}
                                >
                                  <IconButton
                                    onClick={($event) => {
                                      handlePolicyEvents(
                                        "policySearchText",
                                        document.getElementById(
                                          "filled1-search"
                                        ).value
                                      );
                                    }}
                                    sx={{
                                      padding: "0px",
                                    }}
                                  >
                                    <Search />
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                            sx={{
                              input: {
                                padding: "5px",
                                width: "20rem",
                                background: "#fff",
                              },
                            }}
                          />

                          <Pagination
                            onChange={($event, value) => {
                              handlePolicyEvents("policyPageNo", value);
                            }}
                            page={configPopupData.policyPageNo}
                            count={configPopupData.policyPageCount}
                            color="primary"
                          />
                        </Box>

                        {configPopupData.selectedGraph.includes(
                          "Detection Trend View"
                        ) ? (
                          <div style={{ fontSize: "13px", fontWeight: "bold" }}>
                            Maximum 5 policies can be selected at a time.
                          </div>
                        ) : (
                          <FormControlLabel
                            label="Select All Policy"
                            control={
                              <Checkbox
                                checked={
                                  configPopupData.selectedGraph.includes(
                                    "Detection Trend View"
                                  )
                                    ? false
                                    : configPopupData.allPolicySelected
                                }
                                onChange={($event) => {
                                  setChecboxVal($event, "allPolicySelected");
                                }}
                              />
                            }
                          />
                        )}

                        {!configPopupData.allPolicySelected && (
                          <Box
                            sx={{
                              height: "15rem",
                              overflow: "hidden",
                              boxShadow: "0px 0px 3px 0px lightgray",
                              marginTop: "0.5rem",
                              padding: "5px",
                            }}
                          >
                            {configPopupData.filteredPolicy.map((el, i) => {
                              return (
                                <FormControlLabel
                                  key={i}
                                  sx={{
                                    width: "45%",
                                    margin: "2px",
                                  }}
                                  control={
                                    <Checkbox
                                      checked={configPopupData.selectedPolicy.includes(
                                        el
                                      )}
                                      onChange={($event) =>
                                        handleEvents(
                                          "checkbox",
                                          "selectedPolicy",
                                          $event,
                                          el
                                        )
                                      }
                                    />
                                  }
                                  label={el}
                                />
                              );
                            })}
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  )}
              </Box>
            )}
          </Box>
        </DialogContent>
      )}

      <DialogActions sx={{ boxShadow: "0px 0px 0px 1px lightgray" }}>
        <Button
          variant="contained"
          onClick={() => {
            onClose(configPopupData, "submit");
            resetState();
          }}
          disabled={
            (configPopupData.selectedView !== "Graph" &&
              configPopupData?.selectedInterval?.length > 0) ||
            (configPopupData.selectedView === "Graph" &&
              configPopupData.selectedGraph.length > 0 &&
              configPopupData?.selectedInterval?.length > 0)
              ? false
              : true
          }
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VunerabilityConfig;
