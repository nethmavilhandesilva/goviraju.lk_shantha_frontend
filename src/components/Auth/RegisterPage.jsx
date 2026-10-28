// src/components/Auth/RegisterPage.jsx
import React, { useState } from "react";
import api from "../../api"; // ✅ USE CENTRALIZED AXIOS INSTANCE
import { SHOP_NAME, SHOP_PHONE } from "../../config/shop";
import { APP_BASE } from "../../config/paths";
import "./LoginPage.css";

// 0-4 score used for the strength bar under each password
const passwordStrength = (value) => {
  let score = 0;
  if (value.length >= 6) score++;
  if (value.length >= 10) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return value ? Math.max(score, 1) : 0;
};

const emptyForm = {
  name: "",
  user_id: "",
  email: "",
  password: "",
  confirmPassword: "",
  password2: "",
  confirmPassword2: "",
};

// One password box with show/hide, strength bar or match note
const PasswordField = ({ id, label, icon, value, onChange, placeholder, show, onToggle, disabled, strength, matchNote }) => (
  <div className="lp-field">
    <label className="lp-label" htmlFor={id}>{label}</label>
    <div className="lp-input-wrap">
      <span className="lp-input-icon" aria-hidden="true">{icon}</span>
      <input
        id={id}
        type={show ? "text" : "password"}
        className="lp-input has-toggle"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
        minLength={6}
        required
        disabled={disabled}
      />
      <button type="button" className="lp-toggle" onClick={onToggle}>
        {show ? "Hide" : "Show"}
      </button>
    </div>
    {strength !== undefined && (
      <div className={`lp-strength s${strength}`} aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
    )}
    {matchNote}
  </div>
);

const RegisterPage = () => {
  const [form, setForm] = useState(emptyForm);
  const [show, setShow] = useState({});
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const setField = (name) => (e) => setForm((prev) => ({ ...prev, [name]: e.target.value }));
  const toggle = (name) => () => setShow((prev) => ({ ...prev, [name]: !prev[name] }));

  const matchNote = (value, confirm) => {
    if (!confirm) return null;
    return value === confirm
      ? <div className="lp-field-note ok">✓ Passwords match</div>
      : <div className="lp-field-note bad">✗ Passwords do not match</div>;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Frontend password validation
    if (form.password !== form.confirmPassword) {
      setError("First passwords do not match.");
      return;
    }
    if (form.password2 !== form.confirmPassword2) {
      setError("Second passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post("/register", {
        name: form.name,
        user_id: form.user_id,
        email: form.email,
        password: form.password,
        password_confirmation: form.confirmPassword, // ✅ Laravel confirmed rule
        password2: form.password2,
        password2_confirmation: form.confirmPassword2,
      });

      if (response.data.user) {
        setSuccess("User registered successfully! You can now login.");
        setForm(emptyForm);
        setShow({});
      }
    } catch (err) {
      const fieldErrors = err.response?.data?.errors;
      const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : null;
      setError(firstFieldError || err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="lp-root">
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

          <p className="lp-headline">නව ගිණුමක් සාදන්න<br />Create a new account</p>
          <p className="lp-sub">
            ගිණුම ආරක්ෂිත කිරීමට මුරපද දෙකක් ඇතුලත් කරන්න. පිවිසීමේදී මුරපද දෙකම අවශ්‍ය වේ.
          </p>

          <div className="lp-stats">
            <div className="lp-stat"><strong>🔒</strong>පළමු මුරපදය</div>
            <div className="lp-stat"><strong>🔐</strong>දෙවන මුරපදය</div>
            <div className="lp-stat"><strong>✅</strong>ආරක්ෂිත පිවිසුම</div>
          </div>

          <div className="lp-contact">
            <span aria-hidden="true">📞</span>
            <a href={`tel:${SHOP_PHONE}`}>{SHOP_PHONE}</a>
          </div>
        </div>

        {/* Form side */}
        <div className="lp-form-side">
          <div className="lp-form-head">
            <h2>ලියාපදිංචි වන්න</h2>
            <p>Register a new user with two passwords</p>
          </div>

          {error && (
            <div className="lp-error" role="alert">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="lp-success" role="status">
              <span aria-hidden="true">✅</span>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleRegister}>
            <div className="lp-field">
              <label className="lp-label" htmlFor="rp-name">සම්පූර්ණ නම / Full Name</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon" aria-hidden="true">🧑</span>
                <input id="rp-name" type="text" className="lp-input" value={form.name} onChange={setField("name")}
                  placeholder="Enter full name" autoComplete="name" required disabled={isLoading} />
              </div>
            </div>

            <div className="lp-row">
              <div className="lp-field">
                <label className="lp-label" htmlFor="rp-user">පරිශීලක නාමය / User ID</label>
                <div className="lp-input-wrap">
                  <span className="lp-input-icon" aria-hidden="true">👤</span>
                  <input id="rp-user" type="text" className="lp-input" value={form.user_id} onChange={setField("user_id")}
                    placeholder="Choose a user ID" autoComplete="username" required disabled={isLoading} />
                </div>
              </div>

              <div className="lp-field">
                <label className="lp-label" htmlFor="rp-email">ඊමේල් / Email</label>
                <div className="lp-input-wrap">
                  <span className="lp-input-icon" aria-hidden="true">✉️</span>
                  <input id="rp-email" type="email" className="lp-input" value={form.email} onChange={setField("email")}
                    placeholder="name@example.com" autoComplete="email" required disabled={isLoading} />
                </div>
              </div>
            </div>

            <div className="lp-section-title">🔒 පළමු මුරපදය / First Password</div>
            <div className="lp-row">
              <PasswordField id="rp-pass" label="මුරපදය / Password" icon="🔒" value={form.password}
                onChange={setField("password")} placeholder="At least 6 characters" show={show.password}
                onToggle={toggle("password")} disabled={isLoading} strength={passwordStrength(form.password)} />
              <PasswordField id="rp-pass-confirm" label="තහවුරු කරන්න / Confirm" icon="🔒" value={form.confirmPassword}
                onChange={setField("confirmPassword")} placeholder="Re-enter password" show={show.confirmPassword}
                onToggle={toggle("confirmPassword")} disabled={isLoading}
                matchNote={matchNote(form.password, form.confirmPassword)} />
            </div>

            <div className="lp-section-title">🔐 දෙවන මුරපදය / Second Password</div>
            <div className="lp-row">
              <PasswordField id="rp-pass2" label="මුරපදය / Password" icon="🔐" value={form.password2}
                onChange={setField("password2")} placeholder="At least 6 characters" show={show.password2}
                onToggle={toggle("password2")} disabled={isLoading} strength={passwordStrength(form.password2)} />
              <PasswordField id="rp-pass2-confirm" label="තහවුරු කරන්න / Confirm" icon="🔐" value={form.confirmPassword2}
                onChange={setField("confirmPassword2")} placeholder="Re-enter password" show={show.confirmPassword2}
                onToggle={toggle("confirmPassword2")} disabled={isLoading}
                matchNote={matchNote(form.password2, form.confirmPassword2)} />
            </div>

            <button type="submit" className="lp-submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="lp-spinner" aria-hidden="true"></span>
                  Registering...
                </>
              ) : (
                "ලියාපදිංචි වන්න · Register →"
              )}
            </button>

            <div className="lp-register">
              Already have an account?{" "}
              <a href={`${APP_BASE}/login`} className="lp-link">
                Sign in
              </a>
            </div>
          </form>

          <div className="lp-footer">© {new Date().getFullYear()} {SHOP_NAME}</div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
