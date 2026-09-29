import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import api from "../api/client";
import { useSocket } from "../context/SocketContext";

export default function VPN() {
  const [sessions, setSessions] = useState([]);
  const { liveVpn } = useSocket();

  useEffect(() => {
    api.get("/vpn").then((r) => setSessions(r.data));
  }, []);

  const disconnect = async (id) => {
    await api.put(`/vpn/${id}/disconnect`);
    setSessions((prev) => prev.map((s) => s._id === id ? { ...s, status: "DISCONNECTED" } : s));
  };

  const allSessions = liveVpn.length > 0 ? liveVpn : sessions;
  const active = allSessions.filter((s) => s.status === "CONNECTED");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">VPN Sessions</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-green-400/10 rounded-lg"><Wifi size={20} className="text-green-400" /></div>
          <div><p className="text-gray-400 text-xs">Active Sessions</p><p className="text-2xl font-bold">{active.length}</p></div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-gray-400/10 rounded-lg"><WifiOff size={20} className="text-gray-400" /></div>
          <div><p className="text-gray-400 text-xs">Total Sessions</p><p className="text-2xl font-bold">{allSessions.length}</p></div>
        </div>
      </div>

      <div className="table-scroll bg-gray-800 rounded-xl">
        <table className="table-content w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Assigned IP</th>
              <th className="text-left px-4 py-3">Allowed Networks</th>
              <th className="text-left px-4 py-3">Connected At</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {allSessions.map((s) => (
              <tr key={s._id} className="border-b border-gray-700/50">
                <td className="px-4 py-3 font-semibold">{s.username}</td>
                <td className="px-4 py-3 font-mono text-orange-400">{s.assignedIP}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{s.allowedNetworks?.join(", ")}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(s.connectedAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.status === "CONNECTED" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {s.status === "CONNECTED" && (
                    <button onClick={() => disconnect(s._id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Disconnect</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
