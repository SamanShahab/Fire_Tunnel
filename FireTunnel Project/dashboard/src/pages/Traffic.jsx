import { useEffect, useState } from "react";
import api from "../api/client";
import { useSocket } from "../context/SocketContext";

const scenarios = ["", "MINIMAL", "FIREWALL", "FIREWALL_VPN"];
const actions = ["", "ALLOW", "BLOCK"];

export default function Traffic() {
  const [events, setEvents] = useState([]);
  const [scenario, setScenario] = useState("");
  const [action, setAction] = useState("");
  const { liveEvents } = useSocket();

  useEffect(() => {
    const params = new URLSearchParams();
    if (scenario) params.set("scenario", scenario);
    if (action) params.set("action", action);
    params.set("limit", "200");
    api.get(`/events?${params}`).then((r) => setEvents(r.data));
  }, [scenario, action]);

  const allEvents = [...liveEvents.filter((e) => (!scenario || e.scenario === scenario) && (!action || e.action === action)), ...events].slice(0, 200);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Traffic Monitor</h2>

      <div className="flex gap-3">
        <select className="bg-gray-800 px-3 py-2 rounded-lg text-sm" value={scenario} onChange={(e) => setScenario(e.target.value)}>
          <option value="">All Scenarios</option>
          {scenarios.slice(1).map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="bg-gray-800 px-3 py-2 rounded-lg text-sm" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All Actions</option>
          {actions.slice(1).map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>

      <div className="table-scroll bg-gray-800 rounded-xl">
        <table className="table-content w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-left px-4 py-3">Destination</th>
              <th className="text-left px-4 py-3">Protocol</th>
              <th className="text-left px-4 py-3">Port</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Scenario</th>
            </tr>
          </thead>
          <tbody>
            {allEvents.map((e, i) => (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-2 text-gray-500 text-xs">{new Date(e.timestamp).toLocaleTimeString()}</td>
                <td className="px-4 py-2">{e.source} <span className="text-gray-500 text-xs">({e.sourceZone})</span></td>
                <td className="px-4 py-2">{e.destination} <span className="text-gray-500 text-xs">({e.destinationZone})</span></td>
                <td className="px-4 py-2 text-gray-400">{e.protocol}</td>
                <td className="px-4 py-2 font-mono text-gray-400">{e.port}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${e.action === "BLOCK" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                    {e.action}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">{e.scenario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
