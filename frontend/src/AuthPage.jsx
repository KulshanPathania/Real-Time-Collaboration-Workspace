import { useState } from "react";
import { FileText, LockKeyhole, Mail, UserRound } from "lucide-react";
import "./AuthPage.css";

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/auth/${isRegister ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...(isRegister ? { name } : {}),
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed.");
      }

      setPassword("");
      onAuthenticated(data.user);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the server. Make sure the backend is running."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand-icon">
          <FileText size={27} />
        </div>

        <h1>CollabSpace</h1>
        <p className="auth-subtitle">
          {isRegister
            ? "Create an account and start collaborating."
            : "Welcome back. Sign in to your workspace."}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={!isRegister ? "auth-tab active" : "auth-tab"}
            onClick={() => switchMode("login")}
          >
            Login
          </button>

          <button
            type="button"
            className={isRegister ? "auth-tab active" : "auth-tab"}
            onClick={() => switchMode("register")}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <label className="auth-field">
              <span>Full name</span>
              <div className="auth-input-wrap">
                <UserRound size={18} />
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </div>
            </label>
          )}

          <label className="auth-field">
            <span>Email address</span>
            <div className="auth-input-wrap">
              <Mail size={18} />
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-input-wrap">
              <LockKeyhole size={18} />
              <input
                type="password"
                autoComplete={
                  isRegister ? "new-password" : "current-password"
                }
                placeholder={
                  isRegister ? "At least 8 characters" : "Enter your password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={isRegister ? 8 : undefined}
                maxLength={72}
                required
              />
            </div>
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Login to workspace"}
          </button>
        </form>

        <p className="auth-switch-text">
          {isRegister ? "Already have an account?" : "New to CollabSpace?"}{" "}
          <button
            type="button"
            onClick={() =>
              switchMode(isRegister ? "login" : "register")
            }
          >
            {isRegister ? "Login" : "Create an account"}
          </button>
        </p>

        <p className="auth-security-note">
          Your account is authenticated by the workspace server.
        </p>
      </section>
    </main>
  );
}