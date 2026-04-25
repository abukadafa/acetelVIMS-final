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
    <div className="tms-login-shell">
      {/* ── Left dark panel ── */}
      <div className="tms-login-left">
        <div className="tms-login-left-inner">
          <div className="tms-brand-row">
            <img src="/assets/acetel-logo.png" alt="ACETEL" className="tms-brand-logo" />
            <div className="tms-brand-text">
              <span className="tms-brand-name">ACETEL VIMS</span>
              <span className="tms-brand-sub">Virtual Internship Management</span>
            </div>
          </div>

          <div className="tms-hero-content">
            <div className="tms-status-pill">
              <span className="tms-status-dot" />
              Institutional Portal Active
            </div>
            <h1 className="tms-hero-title">
              Elevate Your Internship<br />Management Experience.
            </h1>
            <p className="tms-hero-desc">
              The professional platform for tracking virtual internship milestones and orchestrating 
              collaboration between students, supervisors, and coordinators.
            </p>
            <div className="tms-feature-pills">
              <span className="tms-feature-pill">Milestone Intelligence</span>
              <span className="tms-feature-pill">Real-time Sync</span>
              <span className="tms-feature-pill">Biometric Attendance</span>
            </div>
          </div>

          <div className="tms-left-footer">
            © 2026 ACETEL VIRTUAL INTERNSHIP MANAGEMENT SYSTEM
          </div>
        </div>
      </div>

      {/* ── Right white panel ── */}
      <div className="tms-login-right">
        <div className="tms-login-form-wrap">
          <div className="tms-right-logo">
            <img src="/assets/noun-logo.png" alt="NOUN" className="tms-right-logo-img" />
            <div>
              <div className="tms-right-logo-name">ACETEL VIMS</div>
              <div className="tms-right-logo-sub">Virtual Internship Management</div>
            </div>
          </div>

          <div className="tms-form-header">
            <h2 className="tms-form-title">Sign in</h2>
            <p className="tms-form-subtitle">Enter your credentials to access your dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="tms-form">
            <div className="tms-field">
              <label className="tms-label">Email Address</label>
              <input
                type="text"
                className="tms-input"
                placeholder="your@email.com or username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="tms-field">
              <div className="tms-label-row">
                <label className="tms-label">Password</label>
                <Link to="/reset" className="tms-forgot">Forgot password?</Link>
              </div>
              <input
                type="password"
                className="tms-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="tms-remember-row">
              <label className="tms-checkbox-label">
                <input type="checkbox" className="tms-checkbox" />
                Keep me signed in
              </label>
            </div>

            <button type="submit" className="tms-submit-btn" disabled={loading}>
              {loading ? <span className="tms-spinner" /> : 'Sign In'}
            </button>

            <div className="tms-or-divider">
              <span className="tms-or-line" />
              <span className="tms-or-text">or</span>
              <span className="tms-or-line" />
            </div>

            <Link to="/register" className="tms-register-btn">
              Register Student Account
            </Link>
          </form>

          <div className="tms-back-link">
            <Link to="/">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
