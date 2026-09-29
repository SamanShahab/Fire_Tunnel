import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import api from "../api/client";

const zones = ["INTERNAL", "GUEST", "DMZ", "EXTERNAL", "VPN", "ANY"];
const protocols = ["ANY", "TCP", "UDP", "ICMP"];

const emptyRule = { name: "", sourceZone: "GUEST", destinationZone: "INTERNAL", protocol: "ANY", port: "ANY", action: "BLOCK", priority: 100 };

export default function FirewallRules() {
  const [rules, setRules] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [form, setForm] = useState(emptyRule);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    api.get("/rules").then((r) => setRules(r.data));
    api.get("/rules/conflicts").then((r) => setConflicts(r.data));
  };

  useEffect(() => { load(); }, []);

  const addRule = async (e) => {
    e.preventDefault();
    await api.post("/rules", form);
    setForm(emptyRule);
    setShowForm(false);
    load();
  };

  const deleteRule = async (id) => {
    await api.delete(`/rules/${id}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Firewall Rules</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          <Plus size={16} /> Add Rule
        </button>
      </div>

      {conflicts.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-400 font-semibold mb-2">
            <AlertTriangle size={16} /> {conflicts.length} Rule Conflict(s) Detected
          </div>
          {conflicts.map((c, i) => (
            <p key={i} className="text-sm text-yellow-300">{c.message}</p>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={addRule} className="bg-gray-800 rounded-xl p-4 grid grid-cols-2 gap-3">
          <input className="bg-gray-900 px-3 py-2 rounded-lg text-sm col-span-2" placeholder="Rule name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          {[["sourceZone", "Source Zone"], ["destinationZone", "Destination Zone"]].map(([key, label]) => (
            <select key={key} className="bg-gray-900 px-3 py-2 rounded-lg text-sm" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
              {zones.map((z) => <option key={z}>{z}</option>)}
            </select>
          ))}
          <select className="bg-gray-900 px-3 py-2 rounded-lg text-sm" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
            {protocols.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input className="bg-gray-900 px-3 py-2 rounded-lg text-sm" placeholder="Port (e.g. 80 or ANY)" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
          <select className="bg-gray-900 px-3 py-2 rounded-lg text-sm" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
            <option>ALLOW</option><option>BLOCK</option>
          </select>
          <input type="number" className="bg-gray-900 px-3 py-2 rounded-lg text-sm" placeholder="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
          <button type="submit" className="col-span-2 bg-orange-500 hover:bg-orange-600 py-2 rounded-lg text-sm font-semibold transition-colors">Save Rule</button>
        </form>
      )}

      <div className="table-scroll bg-gray-800 rounded-xl">
        <table className="table-content w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left px-4 py-3">Priority</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-left px-4 py-3">Destination</th>
              <th className="text-left px-4 py-3">Protocol</th>
              <th className="text-left px-4 py-3">Port</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r._id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-3 text-gray-400">{r.priority}</td>
                <td className="px-4 py-3">{r.name}</td>
                <td className="px-4 py-3 text-blue-400">{r.sourceZone}</td>
                <td className="px-4 py-3 text-purple-400">{r.destinationZone}</td>
                <td className="px-4 py-3 text-gray-400">{r.protocol}</td>
                <td className="px-4 py-3 font-mono text-gray-400">{r.port}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.action === "BLOCK" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                    {r.action}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteRule(r._id)} className="text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
