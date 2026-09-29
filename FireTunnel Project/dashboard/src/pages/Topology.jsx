import { useEffect, useState } from "react";
import api from "../api/client";

const zoneColors = {
  FIREWALL: "bg-orange-500",
  INTERNAL: "bg-blue-500",
  DMZ: "bg-yellow-500",
  GUEST: "bg-purple-500",
  EXTERNAL: "bg-red-500",
  VPN: "bg-green-500",
};

const zoneOrder = ["EXTERNAL", "FIREWALL", "INTERNAL", "DMZ", "GUEST", "VPN"];

export default function Topology() {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    api.get("/devices").then((r) => setDevices(r.data));
  }, []);

  const grouped = zoneOrder.reduce((acc, zone) => {
    acc[zone] = devices.filter((d) => d.zone === zone);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Network Topology</h2>

      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex flex-col items-center gap-4">
          {zoneOrder.map((zone) => (
            <div key={zone} className="w-full">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-3 h-3 rounded-full ${zoneColors[zone]}`} />
                <span className="text-sm font-semibold text-gray-300">{zone} Zone</span>
              </div>
              <div className="flex flex-wrap gap-3 pl-5">
                {grouped[zone]?.length === 0 && (
                  <span className="text-gray-600 text-xs">No devices</span>
                )}
                {grouped[zone]?.map((d) => (
                  <div key={d._id} className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm">
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-gray-400 text-xs">{d.ip}</p>
                    <p className="text-gray-500 text-xs">{d.os}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${d.status === "ONLINE" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
              {zone !== "VPN" && (
                <div className="flex justify-center my-2">
                  <div className="w-0.5 h-6 bg-gray-600" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="table-scroll bg-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">IP Address Table</h3>
        <table className="table-content w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2">Device</th>
              <th className="text-left py-2">IP</th>
              <th className="text-left py-2">Zone</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d._id} className="border-b border-gray-700/50">
                <td className="py-2">{d.name}</td>
                <td className="py-2 font-mono text-orange-400">{d.ip}</td>
                <td className="py-2">{d.zone}</td>
                <td className="py-2 text-gray-400">{d.type}</td>
                <td className="py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${d.status === "ONLINE" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
