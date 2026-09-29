import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import api from "../api/client";

export default function Reports() {
  const [comparison, setComparison] = useState({});
  const [testSummary, setTestSummary] = useState({});
  const [perfAverages, setPerfAverages] = useState({});
  const [eventStats, setEventStats] = useState({});

  useEffect(() => {
    api.get("/scans/comparison").then((r) => setComparison(r.data));
    api.get("/performance/averages").then((r) => setPerfAverages(r.data));

    const scenarios = ["MINIMAL", "FIREWALL", "FIREWALL_VPN"];
    Promise.all(scenarios.map((s) => api.get(`/tests?scenario=${s}`))).then((results) => {
      const summary = {};
      results.forEach((r, i) => {
        const tests = r.data;
        summary[scenarios[i]] = {
          total: tests.length,
          pass: tests.filter((t) => t.status === "PASS").length,
          fail: tests.filter((t) => t.status === "FAIL").length,
        };
      });
      setTestSummary(summary);
    });

    Promise.all(scenarios.map((s) => api.get(`/events/stats?scenario=${s}`))).then((results) => {
      const stats = {};
      results.forEach((r, i) => { stats[scenarios[i]] = r.data; });
      setEventStats(stats);
    });
  }, []);

  const scenarios = ["MINIMAL", "FIREWALL", "FIREWALL_VPN"];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Final Comparison Report</h2>

      <div className="table-scroll bg-gray-800 rounded-xl">
        <table className="table-content w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left px-4 py-3">Metric</th>
              {scenarios.map((s) => <th key={s} className="text-left px-4 py-3 text-orange-400">{s.replace("_", " + ")}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Hosts Discovered", key: (s) => comparison[s]?.hostsDiscovered ?? "—" },
              { label: "Open Ports", key: (s) => comparison[s]?.openPorts ?? "—" },
              { label: "Exposed Services", key: (s) => comparison[s]?.exposedServices ?? "—" },
              { label: "Blocked Events", key: (s) => eventStats[s]?.blocked ?? "—" },
              { label: "Allowed Events", key: (s) => eventStats[s]?.allowed ?? "—" },
              { label: "Tests Passed", key: (s) => testSummary[s] ? `${testSummary[s].pass}/${testSummary[s].total}` : "—" },
              { label: "Avg Latency (ms)", key: (s) => perfAverages[s]?.LATENCY?.average ?? "—" },
              { label: "Avg Throughput", key: (s) => perfAverages[s]?.THROUGHPUT ? `${perfAverages[s].THROUGHPUT.average} ${perfAverages[s].THROUGHPUT.unit}` : "—" },
            ].map(({ label, key }) => (
              <tr key={label} className="border-b border-gray-700/50">
                <td className="px-4 py-3 text-gray-400">{label}</td>
                {scenarios.map((s) => <td key={s} className="px-4 py-3 font-semibold">{key(s)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comparison.MINIMAL && comparison.FIREWALL && (
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 inline-flex items-center gap-2">Attack Surface Reduction (Minimal <ArrowRight size={14} aria-hidden="true" /> Firewall)</h3>
          {[
            { label: "Exposed Services", baseline: comparison.MINIMAL.exposedServices, protected: comparison.FIREWALL.exposedServices },
            { label: "Open Ports", baseline: comparison.MINIMAL.openPorts, protected: comparison.FIREWALL.openPorts },
            { label: "Reachable Hosts", baseline: comparison.MINIMAL.hostsDiscovered, protected: comparison.FIREWALL.hostsDiscovered },
          ].map(({ label, baseline, protected: prot }) => {
            const reduction = baseline > 0 ? (((baseline - prot) / baseline) * 100).toFixed(1) : 0;
            return (
              <div key={label} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-green-400 font-semibold">{reduction}% reduced</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(reduction, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
