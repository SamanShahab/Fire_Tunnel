import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Network, Shield, Activity, Wifi,
  AlertTriangle, ScanLine, FlaskConical, BarChart3, FileText, LogOut, Flame, ChevronLeft, ChevronRight
} from "lucide-react";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/topology", icon: Network, label: "Topology" },
  { to: "/rules", icon: Shield, label: "Firewall Rules" },
  { to: "/traffic", icon: Activity, label: "Traffic" },
  { to: "/vpn", icon: Wifi, label: "VPN" },
  { to: "/events", icon: AlertTriangle, label: "Security Events" },
  { to: "/scans", icon: ScanLine, label: "Nmap Scans" },
  { to: "/tests", icon: FlaskConical, label: "Test Matrix" },
  { to: "/performance", icon: BarChart3, label: "Performance" },
  { to: "/reports", icon: FileText, label: "Reports" },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { logout, user } = useAuth();

  return (
    <aside className={`sidebar-shell w-64 flex flex-col h-screen fixed ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar-header p-5 border-b border-white/10">
        <div className="sidebar-brand-row flex items-center justify-between gap-2">
          <div className="brand-mark inline-flex items-center gap-2">
            <span className="brand-icon" aria-hidden="true"><Flame size={18} strokeWidth={2.2} /></span>
            <div className="sidebar-brand-copy">
              <h1 className="text-xl font-black tracking-[0.18em] text-white">FIRE</h1>
              <p className="text-[10px] uppercase tracking-[0.44em] text-cyan-300/80">TUNNEL</p>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>
        <p className="sidebar-console-label text-[11px] mt-4 uppercase tracking-[0.35em] text-slate-400">Security Console</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 text-sm font-medium transition-all ${
                isActive ? "active" : ""
              }`
            }
          >
            <Icon size={16} />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer p-4 border-t border-white/10">
        <div className="user-pill flex items-center justify-between gap-3 rounded-xl px-3 py-2 mb-3">
          <span className="user-pill-label text-xs uppercase tracking-[0.2em] text-slate-400">Operator</span>
          <span className="text-sm font-semibold text-cyan-300">{collapsed ? (user?.username || "G").slice(0, 1).toUpperCase() : user?.username || "Guest"}</span>
        </div>
        <button
          onClick={logout}
          className="logout-button flex items-center gap-2 w-full justify-center rounded-xl px-3 py-2 text-sm font-medium transition-all"
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut size={14} />
          <span className="logout-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}
