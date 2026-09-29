import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import Layout from "./components/Layout";
import IntroLoader from "./components/IntroLoader";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Topology from "./pages/Topology";
import FirewallRules from "./pages/FirewallRules";
import Traffic from "./pages/Traffic";
import VPN from "./pages/VPN";
import SecurityEvents from "./pages/SecurityEvents";
import Scans from "./pages/Scans";
import TestMatrix from "./pages/TestMatrix";
import Performance from "./pages/Performance";
import Reports from "./pages/Reports";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><SocketProvider><Layout /></SocketProvider></ProtectedRoute>}>
        <Route index element={<Overview />} />
        <Route path="topology" element={<Topology />} />
        <Route path="rules" element={<FirewallRules />} />
        <Route path="traffic" element={<Traffic />} />
        <Route path="vpn" element={<VPN />} />
        <Route path="events" element={<SecurityEvents />} />
        <Route path="scans" element={<Scans />} />
        <Route path="tests" element={<TestMatrix />} />
        <Route path="performance" element={<Performance />} />
        <Route path="reports" element={<Reports />} />
      </Route>
    </Routes>
  );
}

function EntryExperience() {
  const { user } = useAuth();
  const [introComplete, setIntroComplete] = useState(() => (
    Boolean(user) || sessionStorage.getItem("firetunnel-intro-complete") === "true"
  ));

  useEffect(() => {
    if (user || introComplete) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem("firetunnel-intro-complete", "true");
      setIntroComplete(true);
    }, reducedMotion ? 600 : 7200);

    return () => window.clearTimeout(timer);
  }, [introComplete, user]);

  return introComplete || user ? <AppRoutes /> : <IntroLoader />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <EntryExperience />
      </AuthProvider>
    </BrowserRouter>
  );
}
