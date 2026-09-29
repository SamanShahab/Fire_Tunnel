import { useEffect, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import api from "../api/client";
import { useSocket } from "../context/SocketContext";

const scenarios = ["MINIMAL", "FIREWALL"];

export default function TestMatrix() {
  const [tests, setTests] = useState([]);
  const [scenario, setScenario] = useState("MINIMAL");
  const { socket } = useSocket();

  const fetchTests = (s) => api.get(`/tests?scenario=${s}&limit=20`).then((r) => {
    // Keep only latest result per testName
    const seen = new Set();
    const unique = r.data.filter((t) => {
      if (seen.has(t.testName)) return false;
      seen.add(t.testName);
      return true;
    });
    setTests(unique);
  });

  useEffect(() => {
    api.get("/scenario/current").then((r) => {
      setScenario(r.data.scenario);
      fetchTests(r.data.scenario);
    });
  }, []);

  useEffect(() => {
    fetchTests(scenario);
    const interval = setInterval(() => fetchTests(scenario), 5000);
    return () => clearInterval(interval);
  }, [scenario]);

  useEffect(() => {
    if (!socket) return;
    socket.on("scenarioChanged", ({ scenario: s }) => setScenario(s));
    socket.on("newTestResult", (t) => {
      if (t.scenario !== scenario) return;
      setTests((prev) => {
        const filtered = prev.filter((x) => x.testName !== t.testName);
        return [t, ...filtered];
      });
    });
    return () => {
      socket.off("scenarioChanged");
      socket.off("newTestResult");
    };
  }, [socket, scenario]);

  const passed = tests.filter((t) => t.status === "PASS").length;
  const failed = tests.filter((t) => t.status === "FAIL").length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Test Matrix</h2>

      <div className="flex gap-3">
        {scenarios.map((s) => (
          <button key={s} onClick={() => setScenario(s)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${scenario === s ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
            {s.replace("_", " + ")}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400 text-xs">Total Tests</p>
          <p className="text-3xl font-bold">{tests.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-green-400 text-xs">PASS</p>
          <p className="text-3xl font-bold text-green-400">{passed}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-red-400 text-xs">FAIL</p>
          <p className="text-3xl font-bold text-red-400">{failed}</p>
        </div>
      </div>

      <div className="table-scroll bg-gray-800 rounded-xl">
        <table className="table-content w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left px-4 py-3">Test</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-left px-4 py-3">Destination</th>
              <th className="text-left px-4 py-3">Expected</th>
              <th className="text-left px-4 py-3">Actual</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t._id} className="border-b border-gray-700/50">
                <td className="px-4 py-2">{t.testName}</td>
                <td className="px-4 py-2 text-blue-400">{t.source}</td>
                <td className="px-4 py-2 text-purple-400">{t.destination}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${t.expectedAction === "BLOCK" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>{t.expectedAction}</span>
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${t.actualAction === "BLOCK" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>{t.actualAction}</span>
                </td>
                <td className="px-4 py-2">
                  {t.status === "PASS" ? <CheckCircle size={16} className="text-green-400" /> : <XCircle size={16} className="text-red-400" />}
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">{t.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
