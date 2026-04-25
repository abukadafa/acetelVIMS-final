import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome to ACETEL VIMS');
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Login failed. Check your credentials.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vims-auth-shell">

      {/* ══ LEFT DARK PANEL ══ */}
      <div className="vims-auth-left">
        <div className="vims-auth-left-inner">

          {/* Top brand — both logos side by side */}
          <div className="vims-auth-brand">
            <img src="/assets/noun-logo.png"   alt="NOUN"   className="vims-auth-brand-logo" />
            <img src="/assets/acetel-logo.png" alt="ACETEL" className="vims-auth-brand-logo" />
            <div className="vims-auth-brand-text">
              <div className="vims-auth-brand-name">ACETEL VIMS</div>
              <div className="vims-auth-brand-sub">Virtual Internship Management</div>
            </div>
          </div>

          {/* Status badges */}
          <div className="vims-auth-badges">
            <span className="vims-auth-badge">
              <span className="vims-auth-badge-dot" />
              Institutional Portal Active
            </span>
            <span className="vims-auth-badge">
              <span className="vims-auth-badge-dot" />
              Digital Internship Ecosystem Active
            </span>
          </div>

          {/* Hero headline */}
          <div className="vims-auth-hero">
            <h1 className="vims-auth-title">
              Elevate Your Internship<br />Management Experience.
            </h1>
            <p className="vims-auth-desc">
              The professional platform for tracking virtual internship milestones and
              orchestrating collaboration between students, supervisors, and coordinators.
            </p>
            <div className="vims-auth-tags">
              <span className="vims-auth-tag">Milestone Intelligence</span>
              <span className="vims-auth-tag">Faculty Collaboration</span>
              <span className="vims-auth-tag">Real-time Synchronization</span>
            </div>
          </div>

          <div className="vims-auth-left-footer">
            © 2026 ACETEL VIRTUAL INTERNSHIP MANAGEMENT SYSTEM
          </div>
        </div>
      </div>

      {/* ══ RIGHT WHITE PANEL ══ */}
      <div className="vims-auth-right">
        <div className="vims-auth-form-wrap">

          {/* Logo on right panel — both logos + name */}
          <div className="vims-auth-right-brand">
            <img src="/assets/noun-logo.png"   alt="NOUN"   className="vims-auth-right-logo" />
            <img src="/assets/acetel-logo.png" alt="ACETEL" className="vims-auth-right-logo" />
            <div>
              <div className="vims-auth-right-name">ACETEL VIMS</div>
              <div className="vims-auth-right-sub">Virtual Internship Management</div>
            </div>
          </div>

          <div className="vims-auth-form-header">
            <h2 className="vims-auth-form-title">Sign in</h2>
            <p className="vims-auth-form-subtitle">
              Enter your credentials to access your dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="vims-auth-form">
            <div className="vims-auth-field">
              <label className="vims-auth-label">Email Address</label>
              <input
                type="text"
                className="vims-auth-input"
                placeholder="your@email.com or username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="vims-auth-field">
              <div className="vims-auth-label-row">
                <label className="vims-auth-label">Password</label>
                <Link to="/reset" className="vims-auth-forgot">Forgot password?</Link>
              </div>
              <input
                type="password"
                className="vims-auth-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <label className="vims-auth-check-row">
              <input type="checkbox" className="vims-auth-checkbox" />
              Keep me signed in
            </label>

            <button type="submit" className="vims-auth-submit" disabled={loading}>
              {loading ? <span className="vims-auth-spinner" /> : 'Sign In'}
            </button>

            <div className="vims-auth-divider">
              <span /><span className="vims-auth-or">or</span><span />
            </div>

            <Link to="/register" className="vims-auth-alt-btn">
              Register Student Account
            </Link>
          </form>

          <div className="vims-auth-back">
            <Link to="/">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
