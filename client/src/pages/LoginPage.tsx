import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNoun, setShowNoun] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => setShowNoun(prev => !prev), 2500);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome to ACETEL VIMS');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vims-shell">

      {/* ══ LEFT PANEL ══ */}
      <div className="vims-left">
        <div className="vims-left-inner">

          {/* Crossfading logo + fixed institution name */}
          <div className="vims-logo-wrap">
            <div className="vims-logo-crossfade">
              <img src="/assets/noun-logo.png" alt="NOUN" className="vims-logo-img" style={{ opacity: showNoun ? 1 : 0 }} />
              <img src="/assets/acetel-logo.png" alt="ACETEL" className="vims-logo-img" style={{ opacity: showNoun ? 0 : 1 }} />
            </div>
            <div className="vims-logo-text">
              <div className="vims-logo-name">
                Africa Centre of Excellence for Technology Enhanced Learning (ACETEL)
              </div>
              <div className="vims-logo-sub">
                Virtual Internship Management System
              </div>
            </div>
          </div>

          {/* Hero */}
          <div className="vims-hero">
            <h1 className="vims-hero-title">
              Empower Virtual<br />Career Transitions.
            </h1>
            <p className="vims-hero-desc">
              The professional platform for bridging academic theory with industry practice and
              orchestrating seamless collaboration between interns, supervisors and organizations.
            </p>
          </div>

          <div className="vims-left-footer">
            © 2026 ACETEL VIRTUAL INTERNSHIP MANAGEMENT SYSTEM
          </div>
        </div>
      </div>

      {/* ══ RIGHT WHITE PANEL ══ */}
      <div className="vims-right">
        <div className="vims-form-card">

          {/* Right panel crossfading logo */}
          <div className="vims-right-brand">
            <div className="vims-right-logo-wrap">
              <img src="/assets/noun-logo.png" alt="NOUN" className="vims-right-logo-img" style={{ opacity: showNoun ? 1 : 0 }} />
              <img src="/assets/acetel-logo.png" alt="ACETEL" className="vims-right-logo-img" style={{ opacity: showNoun ? 0 : 1 }} />
            </div>
            <div>
              <div className="vims-right-brand-name">ACETEL VIMS</div>
              <div className="vims-right-brand-sub">
                {showNoun ? 'National Open University of Nigeria' : 'Africa Centre of Excellence for Technology Enhanced Learning'}
              </div>
            </div>
          </div>

          <h2 className="vims-form-title">Sign in</h2>
          <p className="vims-form-subtitle">Enter your credentials to access your dashboard.</p>

          <form onSubmit={handleSubmit} className="vims-form">
            <div className="vims-field">
              <label className="vims-label">Email Address</label>
              <input
                type="text" className="vims-input"
                placeholder="your@email.com or username"
                value={email} onChange={e => setEmail(e.target.value)} required
              />
            </div>

            <div className="vims-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="vims-label" style={{ margin: 0 }}>Password</label>
                <Link to="/reset" className="vims-forgot">Forgot password?</Link>
              </div>
              <input
                type="password" className="vims-input"
                placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required
              />
            </div>

            <label className="vims-check-row">
              <input type="checkbox" className="vims-checkbox" />
              Keep me signed in
            </label>

            <button type="submit" className="vims-btn-primary" disabled={loading}>
              {loading ? <span className="vims-spinner" /> : 'Sign In'}
            </button>

            <div className="vims-or">
              <span /><span className="vims-or-text">or</span><span />
            </div>

            <Link to="/register" className="vims-btn-outline">
              Register Student Account
            </Link>
          </form>

          <div className="vims-form-footer">
            <Link to="/">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
