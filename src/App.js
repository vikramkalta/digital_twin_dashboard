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
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

import { Model } from "./assets/Model";

// Example Dynamic Room Values
const initialRoomValues = {
  SecondFloorRoom1: "0",
  SecondFloorRoom2: "0",
  SecondFloorRoom3: "0",
  SecondFloorRoom4: "0",
  SecondFloorRoom5: "0",
};

const ROOMS = {
  "Room 1": "SecondFloorRoom1",
  "Room 2": "SecondFloorRoom2",
  "Room 3": "SecondFloorRoom3",
  "Room 4": "SecondFloorRoom4",
  "Room 5": "SecondFloorRoom5",
};

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
  const [mode] = useState("Historical"); // Modes: "Historical", "Forecast"
  const [forecastData, setForecastData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [pieChartData, setPieChartData] = useState([]);

  const [roomValues, setRoomValues] = useState(initialRoomValues);

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
        const response = await fetch("/kpis_data.csv");
        const text = await response.text();
        const parsedData = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
        }).data;
        // Process data: extract CO2 values and month
        const dataWithMonths = parsedData.map((row) => {
          const date = new Date(row.Timestamp); // Ensure the date field exists and is valid
          return {
            roomID: row.RoomID,
            co2: parseInt(row.CO2),
            humidity: parseInt(row.Humidity),
            temperature: parseInt(row.Temperature),
            occupancy: parseInt(row.Occupancy),
            spaceutil: parseInt(row.SpaceUtil),
            month: date.toLocaleString("default", { month: "long" }), // Extract month name
            rowDate: row.Timestamp,
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
        setPieChartData(processRoomDataForPieChart(dataWithMonths));
      } catch (error) {
        console.log("Error in fetchData", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (data.length > 0) updateKpiValue();
  }, [data, selectedMonth, selectedKPI, mode]);

  const processRoomDataForPieChart = (data) => {
    const roomMap = {};

    data.forEach(({ roomID, [selectedKPI.toLowerCase()]: value }) => {
      if (!roomMap[roomID]) {
        roomMap[roomID] = 0;
      }
      roomMap[roomID] += value; // Sum up values per room
    });

    return Object.entries(roomMap).map(([room, value]) => ({
      name: room,
      value,
    }));
  };

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

      const groupByRoomValues = Object.values(
        data.reduce(
          (
            acc,
            { roomID, co2, humidity, temperature, occupancy, spaceutil }
          ) => {
            if (!acc[roomID]) {
              acc[roomID] = {
                roomID,
                count: 0,
                co2: 0,
                humidity: 0,
                temperature: 0,
                occupancy: 0,
                spaceutil: 0,
              };
            }

            acc[roomID].count += 1;
            acc[roomID].co2 += isNaN(co2) ? 0 : co2;
            acc[roomID].humidity += isNaN(humidity) ? 0 : humidity;
            acc[roomID].temperature += isNaN(temperature) ? 0 : temperature;
            acc[roomID].occupancy += isNaN(occupancy) ? 0 : occupancy;
            acc[roomID].spaceutil += isNaN(spaceutil) ? 0 : spaceutil;
            return acc;
          },
          {}
        )
      ).map(
        ({
          roomID,
          co2,
          humidity,
          temperature,
          occupancy,
          spaceutil,
          count,
        }) => ({
          roomID,
          co2: (co2 / count).toFixed(2),
          temperature: (temperature / count).toFixed(2),
          humidity: (humidity / count).toFixed(2),
          occupancy: (occupancy / count).toFixed(2),
          spaceutil: (spaceutil / count).toFixed(2),
        })
      );
      const _roomValues = {};
      for (const room of groupByRoomValues) {
        _roomValues[ROOMS[room.roomID]] = room[selectedKPI.toLowerCase()];
      }
      setRoomValues(_roomValues);
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
    setPieChartData(processRoomDataForPieChart(data));
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

      {/* Room Pie Chart at the Bottom left*/}
      <RoomPieChart data={pieChartData} kpi={selectedKPI.toLowerCase()} />

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
            roomValues={roomValues}
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
  }
  return (
    <div className="kpi-gauge">
      <h3>{kpi}</h3>
      <GaugeChart
        id="gauge-chart"
        nrOfLevels={20} // More levels for smooth transitions
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
    <div
      className="time-series-graph"
      style={{ height: "220px", padding: "5px" }}
    >
      <h3>{selectedKPI} over Time</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={smoothedData}
          margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#007bff"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const COLORS = ["#0088FE", "#00C49F", "#FF9900", "#FF8042", "#A45EE5", "#FF6680"];

const RoomPieChart = ({ data }) => {
  if (!data || data.length === 0) return <p>No data available</p>;

  return (
    <div
      className="room-pie-chart"
      style={{
        height: "250px",
        width: "250px",
        padding: "0px",
        zIndex: 1,
      }}
    >
      <h4 style={{ fontSize: "14px", marginBottom: "5px" }}>Room-wise Data</h4>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={60}
            label={({ _name, percent }) =>
              `${(percent * 100).toFixed(0)}%`
            }
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend
            layout="horizontal" 
            verticalAlign="bottom"
            align="center"
            iconSize={10} 
            wrapperStyle={{ fontSize: "10px", marginTop: "-10px" }} 
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
