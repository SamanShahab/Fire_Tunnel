export default function StatCard({ title, value, icon: Icon, color = "orange", sub }) {
  const colors = {
    orange: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    green: "text-green-400 bg-green-500/10 border-green-500/30",
    red: "text-red-400 bg-red-500/10 border-red-500/30",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  };

  return (
    <div className="stat-card bg-gray-800 rounded-2xl p-4 flex items-center gap-4">
      <div className={`p-3 rounded-xl border ${colors[color]}`}>
        <Icon size={20} className={colors[color].split(" ")[0]} />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{title}</p>
        <p className="text-2xl font-black mt-1 text-white">{value ?? "—"}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
