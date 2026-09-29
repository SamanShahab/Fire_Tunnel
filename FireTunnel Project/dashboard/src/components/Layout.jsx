import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={`app-shell flex min-h-screen text-white ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="dashboard-video-layer" aria-hidden="true">
        <video
          className="dashboard-video"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster=""
          src="/firetunnel-pin-bg.mp4"
        >
          <source src="/firetunnel-pin-bg.mp4" type="video/mp4" />
        </video>
        <div className="video-overlay" />
      </div>

      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)} />
      <main className="main-panel ml-64 flex-1 overflow-auto">
        <div className="page-shell">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
