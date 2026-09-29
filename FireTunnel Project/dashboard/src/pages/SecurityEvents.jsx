import { useEffect, useState } from "react";
import api from "../api/client";

export default function SecurityEvents() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api.get("/events?limit=500").then((r) => setEvents(r.data));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Security Events</h2>

      <div className="table-scroll bg-gray-800 rounded-xl">
        <table className="table-content w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left px-4 py-3">Timestamp</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-left px-4 py-3">Destination</th>
              <th className="text-left px-4 py-3">Protocol/Port</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Reason</th>
              <th className="text-left px-4 py-3">Scenario</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e._id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-2 text-gray-500 text-xs">{new Date(e.timestamp).toLocaleString()}</td>
                <td className="px-4 py-2">{e.sourceIp || e.source}</td>
                <td className="px-4 py-2">{e.destinationIp || e.destination}</td>
                <td className="px-4 py-2 font-mono text-gray-400">{e.protocol}{e.port ? `/${e.port}` : ""}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${e.action === "BLOCK" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                    {e.action}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-400 text-xs">{e.details || e.reason}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{e.scenario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
