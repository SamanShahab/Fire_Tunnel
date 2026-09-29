import { useEffect, useState } from "react";
import api from "../api/client";

export default function Scans() {
  const [comparison, setComparison] = useState({});
  const [scans, setScans] = useState([]);

  useEffect(() => {
    api.get("/scans/comparison").then((r) => setComparison(r.data));
    api.get("/scans").then((r) => setScans(r.data));
  }, []);

  const scenarios = ["MINIMAL", "FIREWALL", "FIREWALL_VPN"];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Nmap Scan Results</h2>

      <div className="grid grid-cols-3 gap-4">
        {scenarios.map((s) => {
          const data = comparison[s];
          return (
            <div key={s} className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-orange-400 mb-3">{s.replace("_", " + ")}</h3>
              {data ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Hosts</span><span className="font-bold">{data.hostsDiscovered}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Open Ports</span><span className="font-bold">{data.openPorts}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Services</span><span className="font-bold">{data.exposedServices}</span></div>
                  <p className="text-gray-500 text-xs mt-2">{new Date(data.timestamp).toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No scan data yet</p>
              )}
            </div>
          );
        })}
      </div>

      {comparison.MINIMAL && comparison.FIREWALL && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Attack Surface Reduction</h3>
          {["hostsDiscovered", "openPorts", "exposedServices"].map((key) => {
            const baseline = comparison.MINIMAL[key] || 0;
            const protected_ = comparison.FIREWALL[key] || 0;
            const reduction = baseline > 0 ? (((baseline - protected_) / baseline) * 100).toFixed(1) : 0;
            return (
              <div key={key} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  <span className="text-green-400">{reduction}% reduced</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(reduction, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="table-scroll bg-gray-800 rounded-xl">
        <table className="table-content w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left px-4 py-3">Scenario</th>
              <th className="text-left px-4 py-3">Target</th>
              <th className="text-left px-4 py-3">Hosts</th>
              <th className="text-left px-4 py-3">Ports</th>
              <th className="text-left px-4 py-3">Services</th>
              <th className="text-left px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((s) => (
              <tr key={s._id} className="border-b border-gray-700/50">
                <td className="px-4 py-2 text-orange-400">{s.scenario}</td>
                <td className="px-4 py-2 font-mono text-gray-400">{s.targetNetwork}</td>
                <td className="px-4 py-2">{s.hostsDiscovered}</td>
                <td className="px-4 py-2">{s.openPorts}</td>
                <td className="px-4 py-2">{s.exposedServices}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{new Date(s.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
