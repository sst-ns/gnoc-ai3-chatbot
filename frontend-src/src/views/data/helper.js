const dateIntervals = ["Daily", "Weekly", "Custom"];
const viewList = ["Summary", "Graph", "Detail"];
const graphTypes = ["Status View", "Detection Trend View"];

const graphConfigurations = {
  tooltip: {
    trigger: "axis",
    axisPointer: {
      type: "shadow",
    },
  },
  legend: {
    padding: 25,
    textStyle: { fontWeight: "bold", fontSize: 14 },
    data: [],
    selected: {},
    type: "scroll",
  },
  grid: {
    left: "3%",
    right: "6%",
    bottom: "3%",
    containLabel: true,
  },
  xAxis: {},
  yAxis: {},
  series: [],
};

function debounce(func, delay) {
  let timeoutId;
  
  return function(...args) {
    const context = this;
    
    clearTimeout(timeoutId);
    
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}


export { dateIntervals, graphConfigurations, viewList, graphTypes, debounce };
