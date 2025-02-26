import "./App.css";
import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import Papa from "papaparse";
import GaugeChart from "react-gauge-chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { Model } from "./assets/Model";

// Thresholds for alerts
const thresholds = {
  CO2: 1000, // CO2 threshold
  Humidity: [30, 60], // Humidity range
  Temperature: [17, 23], // Temperature range
  Occupancy: 50, // Occupancy threshold
  SpaceUtil: [0, 30],
};

function App() {
  const [visibleFloor, setVisibleFloor] = useState("all"); // Default to ground floor
  const [data, setData] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("Select All");
  const [selectedKPI, setSelectedKPI] = useState("CO2"); // Default KPI
  const [kpiValue, setKpiValue] = useState(0);
  const [mode, setMode] = useState("Historical"); // Modes: "Historical", "Forecast"
  const [forecastData, setForecastData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/forecast_data.csv");
        const text = await response.text();
        const parsedData = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
        }).data;
        setForecastData(parsedData);
      } catch (error) {
        console.log("Error in fetchData[forecast]", error);
      }
    };
    fetchData();
  }, []);

  // Load data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/iaq_with_utilization.csv");
        const text = await response.text();
        const parsedData = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
        }).data;
        // Process data: extract CO2 values and month
        const dataWithMonths = parsedData.map((row) => {
          const date = new Date(row.start_time); // Ensure the date field exists and is valid
          return {
            co2: parseInt(row.co2),
            humidity: parseInt(row.humidity),
            temperature: parseInt(row.temp),
            occupancy: parseInt(row.Occupancy),
            spaceutil: parseInt(row.SpaceUtil * 100),
            month: date.toLocaleString("default", { month: "long" }), // Extract month name
            rowDate: row.start_time,
          };
        });

        const uniqueMonths = [
          "Select All",
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ]; // get unique months

        setData(dataWithMonths);
        setMonths(uniqueMonths);
      } catch (error) {
        console.log("Error in fetchData", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (data.length > 0) updateKpiValue();
  }, [data, selectedMonth, selectedKPI, mode]);

  useEffect(() => {
    if (mode === "Historical") {
      return;
    }
    // Check for threshold breaches and show alerts
    if (selectedKPI === "CO2" && kpiValue > thresholds.CO2) {
      alert(`CO2 value (${kpiValue.toFixed(2)}). Needs attention.`);
    } else if (
      selectedKPI === "Humidity" &&
      (kpiValue < thresholds.Humidity[0] || kpiValue > thresholds.Humidity[1])
    ) {
      alert(`Humidity value (${kpiValue.toFixed(2)}%). Needs attention.`);
    } else if (
      selectedKPI === "Temperature" &&
      (kpiValue < thresholds.Temperature[0] ||
        kpiValue > thresholds.Temperature[1])
    ) {
      alert(`Temperature value (${kpiValue.toFixed(2)}°C). Needs attention.`);
    } else if (selectedKPI === "Occupancy" && kpiValue > thresholds.Occupancy) {
      alert(`Occupancy value (${kpiValue.toFixed(2)}). Needs attention.`);
    }
  }, [kpiValue]);

  const updateKpiValue = () => {
    let filteredData = [];
    if (mode === "Historical") {
      filteredData =
        selectedMonth === "Select All"
          ? data
          : data.filter((row) => row.month === selectedMonth);
      const avgHistorical =
        filteredData.reduce((sum, row) => {
          const value = row[selectedKPI.toLowerCase()];
          return sum + (value !== "" && !isNaN(value) ? parseFloat(value) : 0);
        }, 0) / filteredData.length;
      // const kpiData = filteredData.map((el) => {
      //   return {
      //     time: el.start_time,
      //     value: el[selectedKPI.toLowerCase()],
      //   };
      // });
      // setKPIData(kpiData);
      setFilteredData(filteredData);
      setKpiValue(avgHistorical || 0);
    } else {
      const avgForecast =
        forecastData.reduce((sum, row) => {
          const value = row[selectedKPI];
          return sum + (value !== "" && !isNaN(value) ? parseFloat(value) : 0);
        }, 0) / forecastData.length;
      setKpiValue(avgForecast || 0);
    }
  };

  return (
    <div className="App">
      <FloatingMenu
        visibleFloor={visibleFloor}
        setVisibleFloor={setVisibleFloor}
        selectedKPI={selectedKPI}
        setSelectedKPI={setSelectedKPI}
        mode={mode}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        months={months}
      />
      {/* Floating Right Gauge */}
      <KpiGauge kpi={selectedKPI} value={kpiValue} />

      {/* Time Series Graph at the Bottom */}
      <TimeSeriesGraph selectedKPI={selectedKPI} data={filteredData} />

      <Canvas camera={{ fov: 18 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <spotLight
          position={[5, 10, 10]}
          angle={0.3}
          intensity={1}
          castShadow
        />
        <Suspense fallback={null}>
          <Model
            kpi={selectedKPI}
            value={kpiValue}
            visibleFloor={visibleFloor}
          />
        </Suspense>
        <Environment preset="sunset" />
        <OrbitControls />
      </Canvas>
    </div>
  );
}

export default App;

const FloatingMenu = ({
  visibleFloor,
  setVisibleFloor,
  selectedKPI,
  setSelectedKPI,
  mode,
  selectedMonth,
  setSelectedMonth,
  months,
}) => {
  return (
    <div className="floating-menu">
      {/* Floor Selector */}
      <div className="menu-section">
        <h3>Floors</h3>
        <button
          className={visibleFloor === "all" ? "active" : ""}
          onClick={() => setVisibleFloor("all")}
        >
          All Floors
        </button>
        <button
          className={visibleFloor === "1st" ? "active" : ""}
          onClick={() => setVisibleFloor("1st")}
        >
          1st Floor
        </button>
        <button
          className={visibleFloor === "2nd" ? "active" : ""}
          onClick={() => setVisibleFloor("2nd")}
        >
          2nd Floor
        </button>
      </div>

      {/* KPI Selector */}
      <div className="menu-section">
        <h3>KPIs</h3>
        {["CO2", "Humidity", "Temperature", "Occupancy", "SpaceUtil"].map(
          (kpi) => (
            <button
              key={kpi}
              className={selectedKPI === kpi ? "active" : ""}
              onClick={() => setSelectedKPI(kpi)}
            >
              {kpi}
            </button>
          )
        )}
      </div>

      {/* Month Selector (Only If Historical Mode) */}
      {mode === "Historical" && (
        <div className="menu-section">
          <h3>Month</h3>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

const KpiGauge = ({ kpi, value }) => {
  // Normalize value between 0 and 1
  const normalizeValue = (val, min, max) => {
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
  };

  let gaugeValue = 0;

  switch (kpi) {
    case "CO2":
      gaugeValue = normalizeValue(value, 0, thresholds.CO2);
      break;
    case "Humidity":
      gaugeValue = normalizeValue(
        value,
        thresholds.Humidity[0],
        thresholds.Humidity[1]
      );
      break;
    case "Temperature":
      gaugeValue = normalizeValue(
        value,
        thresholds.Temperature[0],
        thresholds.Temperature[1]
      );
      break;
    case "Occupancy":
      gaugeValue = normalizeValue(value, 0, thresholds.Occupancy);
      break;
    case "SpaceUtil":
      gaugeValue = normalizeValue(
        value,
        thresholds.SpaceUtil[0],
        thresholds.SpaceUtil[1]
      );
      break;
    default:
      gaugeValue = 0;
  }
  return (
    <div className="kpi-gauge">
      <h3>{kpi}</h3>
      <GaugeChart
        id="gauge-chart"
        nrOfLevels={20} // More levels for smooth transitions
        // percent={value / 100} // Scale value between 0 and 1
        percent={gaugeValue}
        colors={["#00ff00", "#ffcc00", "#ff0000"]} // Green -> Yellow -> Red
        arcWidth={0.3} // Thickness of gauge
        textColor="#000"
        formatTextValue={() => `${value.toFixed(1)} ${kpi}`}
      />
    </div>
  );
};

const TimeSeriesGraph = ({ selectedKPI, data }) => {
  data = data.map((el) => ({
    time: el.month,
    value: el[selectedKPI.toLowerCase()],
  }));
  // Function to calculate moving average
  const calculateMovingAverage = (data, windowSize) => {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const slice = data.slice(start, i + 1);
      const avg =
        slice.reduce((acc, curr) => acc + curr.value, 0) / slice.length;
      result.push({ ...data[i], value: avg });
    }
    return result;
  };
  // Apply moving average to smooth the data
  const smoothedData = calculateMovingAverage(data, 30); // 3-point moving average

  return (
    <div className="time-series-graph">
      <h3>{selectedKPI} over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={smoothedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Line type="monotone" dataKey="value" stroke="#007bff" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
