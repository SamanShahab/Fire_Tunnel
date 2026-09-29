import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [helpMessage, setHelpMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(form.username, form.password);
      navigate("/");
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="cyber-login min-h-screen flex items-center justify-center px-6">
      <div className="login-shell w-full max-w-md">
        <div className="login-card">
          <div className="login-header">
            <div className="login-brandline">
              <span className="login-brand-icon" aria-hidden="true"><ShieldCheck size={22} strokeWidth={1.7} /></span>
              <div className="login-brand-copy">
                <span>FIRETUNNEL</span>
                <small>SECURITY OPERATIONS</small>
              </div>
            </div>
            <div className="login-status-indicator"><span className="status-dot" /> SYSTEM SECURE</div>
            <div className="login-heading">
              <span className="login-eyebrow">IDENTITY VERIFICATION</span>
              <h1>SECURITY ACCESS</h1>
              <p>Sign in to your protected operations console.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-field">
              <span className="field-label">Username / Email</span>
              <span className="login-input-wrap">
                <UserRound size={17} aria-hidden="true" />
                <input
                  type="text"
                  name="username"
                  className="cyber-input login-input"
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </span>
            </label>
            <label className="login-field">
              <span className="field-label">Password</span>
              <span className="login-input-wrap">
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  type="password"
                  name="password"
                  className="cyber-input login-input"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </span>
            </label>
            {error && <p className="login-message login-error" role="alert">{error}</p>}
            {helpMessage && <p className="login-message" role="status">{helpMessage}</p>}
            <button
              type="submit"
              disabled={loading}
              className="cyber-button login-submit"
            >
              <span>{loading ? "AUTHENTICATING" : "SIGN IN"}</span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <div className="login-form-footer">
              <button
                type="button"
                className="forgot-password"
                onClick={() => setHelpMessage("Contact your system administrator to reset your password.")}
              >
                <KeyRound size={14} aria-hidden="true" /> Forgot Password?
              </button>
              <span>ENCRYPTED SESSION</span>
            </div>
          </form>
          <div className="login-bottom-rule" aria-hidden="true"><span /></div>
        </div>
      </div>
    </main>
  );
}
