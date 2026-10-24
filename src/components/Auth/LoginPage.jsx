import React, { useState } from "react";
import api from "../../api";
import { SHOP_NAME, SHOP_PHONE } from "../../config/shop";
import "./LoginPage.css";
import { APP_BASE } from "../../config/paths";

const LoginPage = () => {
  const [user_id, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  React.useEffect(() => {
    const savedUserId = localStorage.getItem("remembered_user");
    if (savedUserId) {
      setUserId(savedUserId);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await api.post("/login", {
        user_id,
        password,
      });

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        
        if (response.data.user) {
          localStorage.setItem("user", JSON.stringify(response.data.user));
        }

        if (rememberMe) {
          localStorage.setItem("remembered_user", user_id);
        } else {
          localStorage.removeItem("remembered_user");
        }

        window.location.href = `${APP_BASE}/sales`;
      } else {
        setError("Invalid credentials");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const produce = [
    { e: "🥕", top: "8%", left: "6%" },
    { e: "🍅", top: "70%", left: "4%" },
    { e: "🥬", top: "14%", left: "88%" },
    { e: "🍌", top: "78%", left: "90%" },
    { e: "🍍", top: "44%", left: "94%" },
    { e: "🥔", top: "88%", left: "40%" },
    { e: "🍊", top: "4%", left: "48%" },
    { e: "🌶️", top: "40%", left: "2%" },
  ];

  return (
    <div className="lp-root">
      {produce.map((p, i) => (
        <span key={i} className="lp-produce" style={{ top: p.top, left: p.left }} aria-hidden="true">
          {p.e}
        </span>
      ))}

      <div className="lp-card">
        {/* Brand side */}
        <div className="lp-brand">
          <div className="lp-logo">
            <div className="lp-logo-badge" aria-hidden="true">🧺</div>
            <div>
              <h1 className="lp-shop-name">{SHOP_NAME}</h1>
              <p className="lp-tagline">එළවළු හා පළතුරු තොග වෙළෙන්දෝ</p>
            </div>
          </div>

          <p className="lp-headline">තොග කළමනාකරණ පද්ධතිය<br />Vegetable &amp; Fruit Stock System</p>
          <p className="lp-sub">GRN, විකුණුම්, ගොවි ණය සහ දෛනික වාර්තා — සියල්ල එකම තැනකින්.</p>

          <div className="lp-stall" aria-hidden="true">
            <div className="lp-crate">
              <div className="lp-crate-items">🥕🥕🥕</div>
              <div className="lp-crate-label">කැරට්</div>
            </div>
            <div className="lp-crate">
              <div className="lp-crate-items">🍅🍅🍅</div>
              <div className="lp-crate-label">තක්කාලි</div>
            </div>
            <div className="lp-crate">
              <div className="lp-crate-items">🥬🥬🥬</div>
              <div className="lp-crate-label">ගෝවා</div>
            </div>
            <div className="lp-crate">
              <div className="lp-crate-items">🍌🍌🍌</div>
              <div className="lp-crate-label">කෙසෙල්</div>
            </div>
            <div className="lp-crate">
              <div className="lp-crate-items">🥔🥔🥔</div>
              <div className="lp-crate-label">අර්තාපල්</div>
            </div>
            <div className="lp-crate">
              <div className="lp-crate-items">🍍🍍🍍</div>
              <div className="lp-crate-label">අන්නාසි</div>
            </div>
          </div>

          <div className="lp-stats">
            <div className="lp-stat"><strong>📦</strong>තොග පාලනය</div>
            <div className="lp-stat"><strong>⚖️</strong>බර හා මිල</div>
            <div className="lp-stat"><strong>📊</strong>දෛනික වාර්තා</div>
          </div>

          <div className="lp-contact">
            <span aria-hidden="true">📞</span>
            <a href={`tel:${SHOP_PHONE}`}>{SHOP_PHONE}</a>
          </div>
        </div>

        {/* Form side */}
        <div className="lp-form-side">
          <div className="lp-form-head">
            <h2>පිවිසෙන්න</h2>
            <p>Sign in to manage today&apos;s stock and sales</p>
          </div>

          {error && (
            <div className="lp-error" role="alert">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="lp-field">
              <label className="lp-label" htmlFor="lp-user">පරිශීලක නාමය / User ID</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon" aria-hidden="true">👤</span>
                <input
                  id="lp-user"
                  type="text"
                  className="lp-input"
                  value={user_id}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter your user ID"
                  autoComplete="username"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="lp-field">
              <label className="lp-label" htmlFor="lp-pass">මුරපදය / Password</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon" aria-hidden="true">🔒</span>
                <input
                  id="lp-pass"
                  type={showPassword ? "text" : "password"}
                  className="lp-input has-toggle"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="lp-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="lp-options">
              <label className="lp-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>මතක තබා ගන්න</span>
              </label>
              <a href={`${APP_BASE}/forgot-password`} className="lp-link">
                Forgot password?
              </a>
            </div>

            <button type="submit" className="lp-submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="lp-spinner" aria-hidden="true"></span>
                  Authenticating...
                </>
              ) : (
                "පිවිසෙන්න · Sign In →"
              )}
            </button>

            <div className="lp-register">
              New user?{" "}
              <a href={`${APP_BASE}/register`} className="lp-link">
                Create an account
              </a>
            </div>
          </form>

          <div className="lp-hint">Demo: admin / password123</div>

          <div className="lp-footer">© {new Date().getFullYear()} {SHOP_NAME}</div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
