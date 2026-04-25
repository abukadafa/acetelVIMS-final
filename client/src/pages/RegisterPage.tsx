import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Mail, Lock, User, Phone, BookOpen, MapPin, ArrowRight, ArrowLeft, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import api from '../lib/api';

type Step = 'identity' | 'academic' | 'location' | 'account' | 'success';

const STEPS: Step[] = ['identity', 'academic', 'location', 'account'];
const STEP_LABELS = ['Personal Identity', 'Academic Verification', 'Location & Placement', 'Create Account'];

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('identity');
  const [loading, setLoading] = useState(false);
  const [verifyingMatric, setVerifyingMatric] = useState(false);
  const [showNoun, setShowNoun] = useState(true);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', phone: '', matricNumber: '',
    email: '', password: '', confirmPassword: '',
    academicSession: '2024/2025', level: 'MSc', programme: 'MSC-AI',
    stateOfOrigin: '', lga: '', address: '',
    lat: 9.0765, lng: 7.3986
  });
  const [sdmsVerified, setSdmsVerified] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setShowNoun(p => !p), 2500);
    return () => clearInterval(t);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleVerifyMatric = async () => {
    if (!formData.matricNumber) return toast.error('Enter Matric Number');
    setVerifyingMatric(true);
    try {
      const { data } = await api.get(`/auth/verify-matric/${formData.matricNumber}`);
      setFormData(prev => ({
        ...prev,
        firstName: data.student.firstName,
        lastName: data.student.lastName,
        email: data.student.email,
        level: data.student.level
      }));
      setSdmsVerified(true);
      toast.success('Matric Number Verified!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Matric Number not found. Contact Registrar.');
      setSdmsVerified(false);
    } finally {
      setVerifyingMatric(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await api.post('/auth/register', { ...formData, role: 'student' });
      setStep('success');
      toast.success('Registration Successful!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = STEPS.indexOf(step);

  return (
    <div className="vims-shell">

      {/* ══ LEFT PANEL ══ */}
      <div className="vims-left">
        <div className="vims-left-inner">

          {/* Crossfading logo */}
          <div className="vims-logo-wrap">
            <div className="vims-logo-crossfade">
              <img src="/assets/noun-logo.png" alt="NOUN" className="vims-logo-img" style={{ opacity: showNoun ? 1 : 0 }} />
              <img src="/assets/acetel-logo.png" alt="ACETEL" className="vims-logo-img" style={{ opacity: showNoun ? 0 : 1 }} />
            </div>
            <div className="vims-logo-text">
              <div className="vims-logo-name">ACETEL VIMS</div>
              <div className="vims-logo-sub">Student Registration Portal</div>
            </div>
          </div>

          {/* Status pills */}
          <div className="vims-status-row">
            <span className="vims-status-pill"><span className="vims-status-dot" />Secure Registration Portal</span>
            <span className="vims-status-pill"><span className="vims-status-dot" />SDMS Verification Active</span>
          </div>

          {/* Hero */}
          <div className="vims-hero">
            <h1 className="vims-hero-title">
              Start Your Virtual<br />Internship Journey.
            </h1>
            <p className="vims-hero-desc">
              Complete your digital profile to begin tracking your industry placement, logbook entries and academic progress in real-time.
            </p>

            {/* Step progress indicators */}
            <div className="reg-steps">
              {STEP_LABELS.map((label, i) => (
                <div key={i} className={`reg-step ${i <= currentStepIndex ? 'reg-step-done' : ''}`}>
                  <div className="reg-step-dot">
                    {i < currentStepIndex ? <CheckCircle2 size={14} /> : <span>{i + 1}</span>}
                  </div>
                  <span className="reg-step-label">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="vims-left-footer">© 2026 ACETEL VIRTUAL INTERNSHIP MANAGEMENT SYSTEM</div>
        </div>
      </div>

      {/* ══ RIGHT WHITE PANEL ══ */}
      <div className="vims-right">
        <div className="vims-form-card">

          {/* Right brand */}
          <div className="vims-right-brand">
            <div className="vims-right-logo-wrap">
              <img src="/assets/noun-logo.png" alt="NOUN" className="vims-right-logo-img" style={{ opacity: showNoun ? 1 : 0 }} />
              <img src="/assets/acetel-logo.png" alt="ACETEL" className="vims-right-logo-img" style={{ opacity: showNoun ? 0 : 1 }} />
            </div>
            <div>
              <div className="vims-right-brand-name">Student Registration</div>
              <div className="vims-right-brand-sub">ACETEL Virtual Internship Management System</div>
            </div>
          </div>

          {/* Step progress bar */}
          {step !== 'success' && (
            <div className="reg-progress-bar">
              <div className="reg-progress-fill" style={{ width: `${((currentStepIndex + 1) / STEPS.length) * 100}%` }} />
            </div>
          )}

          {/* Form header */}
          {step !== 'success' && (
            <div style={{ marginBottom: '24px' }}>
              <h2 className="vims-form-title">
                {step === 'identity' && 'Personal Identity'}
                {step === 'academic' && 'Academic Details'}
                {step === 'location' && 'Location & Placement'}
                {step === 'account' && 'Create Account'}
              </h2>
              <p className="vims-form-subtitle">
                Step {currentStepIndex + 1} of {STEPS.length} — {STEP_LABELS[currentStepIndex]}
              </p>
            </div>
          )}

          {/* ── STEP 1: Identity ── */}
          {step === 'identity' && (
            <div className="vims-form">
              <div className="vims-field">
                <label className="vims-label">Matric Number</label>
                <div className="reg-input-row">
                  <input
                    type="text" name="matricNumber" className="vims-input"
                    placeholder="NOUN/MSc/2024/..." value={formData.matricNumber}
                    onChange={handleChange}
                    style={{ flex: 1 }}
                  />
                  <button className="reg-verify-btn" onClick={handleVerifyMatric} disabled={verifyingMatric || !formData.matricNumber}>
                    {verifyingMatric ? <Loader2 size={16} className="spin" /> : 'Verify'}
                  </button>
                </div>
              </div>

              {sdmsVerified && (
                <>
                  <div className="reg-verified-badge">
                    <CheckCircle2 size={16} /> Verified with ACETEL Academic Records
                  </div>
                  <div className="reg-two-col">
                    <div className="vims-field">
                      <label className="vims-label">First Name</label>
                      <input type="text" name="firstName" className="vims-input reg-readonly" value={formData.firstName} readOnly />
                    </div>
                    <div className="vims-field">
                      <label className="vims-label">Last Name</label>
                      <input type="text" name="lastName" className="vims-input reg-readonly" value={formData.lastName} readOnly />
                    </div>
                  </div>
                  <button className="vims-btn-primary" onClick={() => setStep('academic')}>
                    Continue <ArrowRight size={16} />
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── STEP 2: Academic ── */}
          {step === 'academic' && (
            <div className="vims-form">
              <div className="vims-field">
                <label className="vims-label">Academic Programme</label>
                <select name="programme" className="vims-input" value={formData.programme} onChange={handleChange}>
                  <option value="MSC-AI">MSc Artificial Intelligence</option>
                  <option value="MSC-CYB">MSc Cybersecurity</option>
                  <option value="MSC-MIS">MSc Management Information System</option>
                  <option value="PHD-AI">PhD Artificial Intelligence</option>
                  <option value="PHD-CYB">PhD Cybersecurity</option>
                  <option value="PHD-MIS">PhD Management Information System</option>
                </select>
              </div>
              <div className="reg-two-col">
                <div className="vims-field">
                  <label className="vims-label">Academic Level</label>
                  <select name="level" className="vims-input" value={formData.level} onChange={handleChange}>
                    <option value="MSc">Master of Science (MSc)</option>
                    <option value="PhD">Doctor of Philosophy (PhD)</option>
                  </select>
                </div>
                <div className="vims-field">
                  <label className="vims-label">Session</label>
                  <select name="academicSession" className="vims-input" value={formData.academicSession} onChange={handleChange}>
                    <option value="2023/2024">2023/2024</option>
                    <option value="2024/2025">2024/2025</option>
                  </select>
                </div>
              </div>
              <div className="vims-field">
                <label className="vims-label">Phone Number</label>
                <input type="tel" name="phone" className="vims-input" placeholder="+234..." value={formData.phone} onChange={handleChange} />
              </div>
              <div className="reg-btn-row">
                <button className="reg-back-btn" onClick={() => setStep('identity')}><ArrowLeft size={16} /> Back</button>
                <button className="vims-btn-primary" style={{ flex: 1 }} onClick={() => setStep('location')}>Next <ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Location ── */}
          {step === 'location' && (
            <div className="vims-form">
              <div className="vims-field">
                <label className="vims-label">State of Residence</label>
                <input type="text" name="stateOfOrigin" className="vims-input" placeholder="e.g. Lagos" value={formData.stateOfOrigin} onChange={handleChange} />
              </div>
              <div className="vims-field">
                <label className="vims-label">Local Government Area</label>
                <input type="text" name="lga" className="vims-input" placeholder="e.g. Alimosho" value={formData.lga} onChange={handleChange} />
              </div>
              <div className="vims-field">
                <label className="vims-label">Full Residential Address</label>
                <input type="text" name="address" className="vims-input" placeholder="House 12, Example Street..." value={formData.address} onChange={handleChange} />
              </div>
              <div className="reg-btn-row">
                <button className="reg-back-btn" onClick={() => setStep('academic')}><ArrowLeft size={16} /> Back</button>
                <button className="vims-btn-primary" style={{ flex: 1 }} onClick={() => setStep('account')}>Final Step <ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Account ── */}
          {step === 'account' && (
            <form onSubmit={handleSubmit} className="vims-form">
              <div className="vims-field">
                <label className="vims-label">Official Email</label>
                <input type="email" name="email" className="vims-input reg-readonly" value={formData.email} readOnly />
              </div>
              <div className="vims-field">
                <label className="vims-label">Create Password</label>
                <input type="password" name="password" className="vims-input" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
              </div>
              <div className="vims-field">
                <label className="vims-label">Confirm Password</label>
                <input type="password" name="confirmPassword" className="vims-input" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} required />
              </div>
              <div className="reg-btn-row">
                <button type="button" className="reg-back-btn" onClick={() => setStep('location')}><ArrowLeft size={16} /> Back</button>
                <button type="submit" className="vims-btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? <Loader2 size={18} className="spin" /> : 'Complete Registration'}
                </button>
              </div>
            </form>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <div className="reg-success">
              <div className="reg-success-icon">
                <CheckCircle2 size={56} />
              </div>
              <h2 className="reg-success-title">Welcome Aboard!</h2>
              <p className="reg-success-desc">
                Your ACETEL account has been created successfully. You can now sign in and start managing your internship logbook.
              </p>
              <Link to="/login" className="vims-btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}>
                Go to Login <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {step !== 'success' && (
            <div className="vims-form-footer">
              Already registered? <Link to="/login">Sign In</Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .reg-steps { display: flex; flex-direction: column; gap: 14px; margin-top: 36px; }
        .reg-step { display: flex; align-items: center; gap: 14px; }
        .reg-step-dot {
          width: 28px; height: 28px; border-radius: 50%;
          background: #e5e7eb; color: #9ca3af;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; font-weight: 800; flex-shrink: 0;
          border: 2px solid #d1d5db;
        }
        .reg-step-done .reg-step-dot {
          background: #1e6b2e; color: #fff; border-color: #1e6b2e;
        }
        .reg-step-label { font-size: 0.88rem; font-weight: 600; color: #374151; }
        .reg-step-done .reg-step-label { color: #0a0a0a; font-weight: 700; }

        .reg-progress-bar {
          height: 4px; background: #e5e7eb; border-radius: 4px;
          margin-bottom: 24px; overflow: hidden;
        }
        .reg-progress-fill {
          height: 100%; background: #1e6b2e;
          border-radius: 4px; transition: width 0.4s ease;
        }

        .reg-input-row { display: flex; gap: 10px; align-items: center; }
        .reg-verify-btn {
          padding: 11px 18px; background: #1e6b2e; color: #fff;
          border: none; border-radius: 8px; font-weight: 700;
          font-size: 0.875rem; cursor: pointer; white-space: nowrap;
          transition: background 0.2s; display: flex; align-items: center; gap: 6px;
          flex-shrink: 0;
        }
        .reg-verify-btn:hover:not(:disabled) { background: #134a1f; }
        .reg-verify-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .reg-verified-badge {
          display: flex; align-items: center; gap: 8px;
          background: #f0fdf4; border: 1.5px solid #16a34a;
          color: #14532d; font-size: 0.82rem; font-weight: 700;
          padding: 10px 14px; border-radius: 8px;
        }

        .reg-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .reg-readonly { background: #f9fafb !important; color: #374151 !important; cursor: not-allowed; }

        .reg-btn-row { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
        .reg-back-btn {
          padding: 12px 16px; border: 1.5px solid #e2e8f0;
          background: #fff; color: #374151; border-radius: 8px;
          font-weight: 600; font-size: 0.875rem; cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          transition: border-color 0.2s, color 0.2s; white-space: nowrap;
        }
        .reg-back-btn:hover { border-color: #1e6b2e; color: #1e6b2e; }

        .reg-success {
          text-align: center;
          display: flex; flex-direction: column;
          align-items: center; gap: 16px; padding: 24px 0;
        }
        .reg-success-icon {
          width: 88px; height: 88px;
          background: #f0fdf4; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #1e6b2e;
        }
        .reg-success-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.7rem; font-weight: 900;
          color: #0a0a0a; margin: 0;
        }
        .reg-success-desc {
          font-size: 0.9rem; color: #374151;
          line-height: 1.65; max-width: 300px;
        }

        .spin { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
