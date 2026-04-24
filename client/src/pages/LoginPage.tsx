import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Mail, Lock, LogIn } from 'lucide-react';

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
      toast.success('Welcome to ACETEL');
      // Use replace so back button does not return to login
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Login failed. Check your credentials.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page centered fade-in">
      <div className="login-right">
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '24px' }}>
              <img src="/assets/noun-logo.png" alt="NOUN" style={{ height: '56px', width: 'auto' }} />
              <img src="/assets/acetel-logo.png" alt="ACETEL" style={{ height: '56px', width: 'auto' }} />
            </div>
            <h2 className="login-heading-robust">
              ACETEL Virtual Internship <br /> Management System
            </h2>
            <p style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}>Access your digital logbook portal</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Work Email</label>
              <div className="search-bar">
                <Mail className="search-icon" size={18} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="admin@acetel.ng or admin"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Secure Password</label>
              <div className="search-bar">
                <Lock className="search-icon" size={18} />
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <Link to="/reset" style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}>Forgot password?</Link>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', height: '48px', fontSize: '1rem' }}>
              {loading ? <div className="spinner" style={{ borderTopColor: '#fff' }} /> : <><LogIn size={20} /> Sign In to Portal</>}
            </button>
          </form>

          <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-3)' }}>
            Need access? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 700 }}>Register Student Account</Link>
          </div>

          <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #eee', fontSize: '0.75rem', textAlign: 'center', color: '#999' }}>
            © 2026 ACETEL Virtual Internship Management System<br />Powered by African Centre of Excellence for Technology Enhanced Learning.
          </div>
        </div>
      </div>
    </div>
  );
}
