import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2, ShieldQuestion } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'react-hot-toast';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Endpoint logic for password reset request
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
      toast.success('Password reset link sent!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Email not found in our records');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page fade-in">
      <div className="login-left" style={{ background: 'var(--primary-dark)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px' }}>
         <div style={{ maxWidth: '400px' }}>
            <ShieldQuestion size={48} style={{ color: 'var(--accent)', marginBottom: '24px' }} />
            <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '16px' }}>Account Recovery</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
               For security reasons, password recovery requires official ACETEL portal verification.
            </p>
         </div>
      </div>

      <div className="login-right">
        <div style={{ width: '100%', maxWidth: '380px' }}>
          {!success ? (
            <>
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>Reset Password</h2>
                <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>Enter your official email to receive a recovery link</p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Official Email</label>
                  <div className="search-bar">
                    <Mail className="search-icon" size={18} />
                    <input 
                      type="email" 
                      className="form-control" 
                      placeholder="e.g. j.doe@acetel.ng" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '30px' }} disabled={loading}>
                  {loading ? <Loader2 className="spinner" size={18} /> : 'Send Reset Link'}
                </button>

                <div style={{ marginTop: '32px', textAlign: 'center' }}>
                  <Link to="/login" className="btn btn-ghost" style={{ width: '100%' }}>
                    <ArrowLeft size={18} /> Return to Login
                  </Link>
                </div>
              </form>
            </>
          ) : (
            <div className="animate-fade-in" style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{ background: 'var(--green-soft)', padding: '20px', borderRadius: '50%' }}>
                  <CheckCircle2 size={64} style={{ color: 'var(--green)' }} />
                </div>
              </div>
              <h2 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '12px' }}>Check Your Inbox</h2>
              <p style={{ color: 'var(--text-3)', marginBottom: '32px' }}>
                If an account exists with <strong>{email}</strong>, a password reset link has been sent. Please check your official ACETEL email.
              </p>
              <Link to="/login" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
