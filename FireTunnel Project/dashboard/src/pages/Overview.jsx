import { useEffect, useState } from "react";
import { Shield, Wifi, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import api from "../api/client";
import StatCard from "../components/StatCard";
import { useSocket } from "../context/SocketContext";

const SCENARIOS = ["MINIMAL", "FIREWALL"];

export default function Overview() {
  const [stats, setStats] = useState({});
  const [vpnActive, setVpnActive] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [activeScenario, setActiveScenario] = useState("MINIMAL");
  const [switching, setSwitching] = useState(false);
  const { liveEvents, socket } = useSocket();

  useEffect(() => {
    api.get("/events/stats").then((r) => setStats(r.data));
    api.get("/vpn/active").then((r) => setVpnActive(r.data.length));
    api.get("/scenario/current").then((r) => setActiveScenario(r.data.scenario));
    api.get("/scans/comparison").then((r) => {
      const data = Object.entries(r.data)
        .filter(([, v]) => v)
        .map(([scenario, v]) => ({
          name: scenario.replace("_", "+"),
          hosts: v.hostsDiscovered,
          ports: v.openPorts,
          services: v.exposedServices,
        }));
      setChartData(data);
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("scenarioChanged", ({ scenario }) => setActiveScenario(scenario));
    return () => socket.off("scenarioChanged");
  }, [socket]);

  async function switchScenario(scenario) {
    setSwitching(true);
    await api.post("/scenario/set", { scenario });
    setActiveScenario(scenario);
    setSwitching(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Overview</h2>

      {/* Scenario Switcher */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Active Polling Scenario</h3>
        <div className="flex gap-3">
          {SCENARIOS.map((s) => (
            <button
              key={s}
              onClick={() => switchScenario(s)}
              disabled={switching}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeScenario === s
                  ? "bg-orange-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-500 self-center">Polling every 5s</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Events" value={stats.total} icon={Shield} color="orange" />
        <StatCard title="Blocked" value={stats.blocked} icon={XCircle} color="red" />
        <StatCard title="Allowed" value={stats.allowed} icon={CheckCircle} color="green" />
        <StatCard title="VPN Active" value={vpnActive} icon={Wifi} color="blue" />
      </div>

      {chartData.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Exposure Comparison (Scenarios)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <XAxis dataKey="name" stroke="#B8B8B8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#B8B8B8" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#0A0A0A", border: "1px solid #666666", color: "#F5F5F5" }} />
              <Area type="monotone" dataKey="hosts" stroke="#FFFFFF" fill="#666666" fillOpacity={0.24} name="Hosts" />
              <Area type="monotone" dataKey="ports" stroke="#B8B8B8" fill="#666666" fillOpacity={0.18} name="Ports" />
              <Area type="monotone" dataKey="services" stroke="#666666" fill="#666666" fillOpacity={0.12} name="Services" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Live Security Events</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {liveEvents.length === 0 && (
            <p className="text-gray-500 text-sm">No live events yet. Events will appear here in real-time.</p>
          )}
          {liveEvents.map((e, i) => (
            <div key={i} className="flex items-center gap-3 text-sm bg-gray-900 rounded-lg px-3 py-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${e.action === "BLOCK" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                {e.action}
              </span>
              <span className="text-gray-300 inline-flex items-center gap-2">{e.sourceIp || e.source}<ArrowRight size={13} aria-hidden="true" />{e.destinationIp || e.destination}</span>
              <span className="text-gray-500 text-xs">{e.scenario}</span>
              <span className="text-gray-500 ml-auto">{new Date(e.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
