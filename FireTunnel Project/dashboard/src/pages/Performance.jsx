import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api from "../api/client";

export default function Performance() {
  const [averages, setAverages] = useState({});

  useEffect(() => {
    api.get("/performance/averages").then((r) => setAverages(r.data));
  }, []);

  const scenarios = ["MINIMAL", "FIREWALL", "FIREWALL_VPN"];

  const latencyData = scenarios.map((s) => ({
    name: s.replace("_", "+"),
    value: averages[s]?.LATENCY?.average ?? null,
  })).filter((d) => d.value !== null);

  const throughputData = scenarios.map((s) => ({
    name: s.replace("_", "+"),
    value: averages[s]?.THROUGHPUT?.average ?? null,
  })).filter((d) => d.value !== null);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Performance Metrics</h2>

      <div className="grid grid-cols-3 gap-4">
        {scenarios.map((s) => (
          <div key={s} className="bg-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-orange-400 mb-3">{s.replace("_", " + ")}</h3>
            {["LATENCY", "THROUGHPUT", "VPN_CONNECT_TIME"].map((type) => {
              const m = averages[s]?.[type];
              return m ? (
                <div key={type} className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">{type.replace("_", " ")}</span>
                  <span className="font-bold">{m.average} <span className="text-gray-500 text-xs">{m.unit}</span></span>
                </div>
              ) : null;
            })}
            {!averages[s] && <p className="text-gray-500 text-sm">No data yet</p>}
          </div>
        ))}
      </div>

      {latencyData.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Latency Comparison (ms)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={latencyData}>
              <XAxis dataKey="name" stroke="#B8B8B8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#B8B8B8" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#0A0A0A", border: "1px solid #666666", color: "#F5F5F5" }} />
              <Bar dataKey="value" fill="#FFFFFF" name="Latency (ms)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {throughputData.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Throughput Comparison</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={throughputData}>
              <XAxis dataKey="name" stroke="#B8B8B8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#B8B8B8" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#0A0A0A", border: "1px solid #666666", color: "#F5F5F5" }} />
              <Bar dataKey="value" fill="#B8B8B8" name="Throughput" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
