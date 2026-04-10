import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Mail, Lock, User, Phone, BookOpen, MapPin, ArrowRight, ArrowLeft, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import api from '../lib/api';

type Step = 'identity' | 'academic' | 'location' | 'account' | 'success';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('identity');
  const [loading, setLoading] = useState(false);
  const [verifyingMatric, setVerifyingMatric] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    matricNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    academicSession: '2024/2025',
    level: 'MSc',
    programme: 'MSC-AI',
    stateOfOrigin: '',
    lga: '',
    address: '',
    lat: 9.0765, // Default to Abuja for mock
    lng: 7.3986
  });

  const [sdmsVerified, setSdmsVerified] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleVerifyMatric = async () => {
    if (!formData.matricNumber) return toast.error('Enter Matric Number');
    setVerifyingMatric(true);
    try {
      // In a real scenario, this endpoint verifies against SDMS
      const { data } = await api.get(`/auth/verify-matric/${formData.matricNumber}`);
      setFormData(prev => ({
        ...prev,
        firstName: data.student.firstName,
        lastName: data.student.lastName,
        email: data.student.email,
        level: data.student.level
      }));
      setSdmsVerified(true);
      toast.success('Matric Number Verified with ACETEL Records!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Matric Number not found. Contact Registrar.');
      setSdmsVerified(false);
    } finally {
      setVerifyingMatric(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        ...formData,
        role: 'student'
      });
      setStep('success');
      toast.success('Registration Successful!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = (next: Step) => setStep(next);

  return (
    <div className="login-page fade-in">
      <div className="login-left" style={{ background: 'var(--primary-dark)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px' }}>
         <div style={{ maxWidth: '400px' }}>
            <ShieldCheck size={48} style={{ color: 'var(--accent)', marginBottom: '24px' }} />
            <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '16px' }}>ACETEL Virtual Internship Management System</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
               Complete your digital logbook profile to start tracking your industry placement and academic progress in real-time.
            </p>

            <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div className={`step-dot ${['identity', 'academic', 'location', 'account', 'success'].indexOf(step) >= 0 ? 'active' : ''}`} />
                  <span style={{ color: '#fff', fontSize: '0.9rem' }}>Personal Identity</span>
               </div>
               <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div className={`step-dot ${['academic', 'location', 'account', 'success'].indexOf(step) >= 1 ? 'active' : ''}`} />
                  <span style={{ color: '#fff', fontSize: '0.9rem' }}>Academic Verification</span>
               </div>
               <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div className={`step-dot ${['location', 'account', 'success'].indexOf(step) >= 2 ? 'active' : ''}`} />
                  <span style={{ color: '#fff', fontSize: '0.9rem' }}>Location & Placement</span>
               </div>
            </div>
         </div>
      </div>

      <div className="login-right">
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {step !== 'success' && (
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>Register New Student</h2>
              <p style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 600 }}>ACETEL Virtual Internship Management System Student Registration</p>
            </div>
          )}

          {step === 'identity' && (
            <div className="animate-slide-up">
              <div className="form-group">
                <label className="form-label">Matric Number</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="search-bar" style={{ flex: 1 }}>
                    <BookOpen className="search-icon" size={18} />
                    <input 
                      type="text" 
                      name="matricNumber"
                      className="form-control" 
                      placeholder="NOUN/MSc/2024/..." 
                      value={formData.matricNumber}
                      onChange={handleChange}
                    />
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleVerifyMatric} 
                    disabled={verifyingMatric || !formData.matricNumber}
                  >
                    {verifyingMatric ? <Loader2 className="spinner" size={18} /> : 'Verify'}
                  </button>
                </div>
              </div>

              {sdmsVerified && (
                <div style={{ marginTop: '20px' }} className="animate-fade-in">
                  <div className="grid-2" style={{ gap: '15px' }}>
                    <div className="form-group">
                      <label className="form-label">First Name</label>
                      <div className="search-bar">
                        <User className="search-icon" size={18} />
                        <input type="text" name="firstName" className="form-control" value={formData.firstName} readOnly />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last Name</label>
                      <div className="search-bar">
                        <User className="search-icon" size={18} />
                        <input type="text" name="lastName" className="form-control" value={formData.lastName} readOnly />
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '30px' }} onClick={() => nextStep('academic')}>
                    Continue <ArrowRight size={18} />
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'academic' && (
            <div className="animate-slide-up">
              <div className="form-group">
                <label className="form-label">Academic Programme</label>
                <select name="programme" className="form-control" value={formData.programme} onChange={handleChange}>
                  <option value="MSC-AI">MSc Artificial Intelligence</option>
                  <option value="MSC-CYB">MSc Cybersecurity</option>
                  <option value="MSC-MIS">MSc Management Information System</option>
                  <option value="PHD-AI">PhD Artificial Intelligence</option>
                  <option value="PHD-CYB">PhD Cybersecurity</option>
                  <option value="PHD-MIS">PhD Management Information System</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Academic Level</label>
                  <select name="level" className="form-control" value={formData.level} onChange={handleChange}>
                    <option value="MSc">Master of Science (MSc)</option>
                    <option value="PhD">Doctor of Philosophy (PhD)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Session</label>
                  <select name="academicSession" className="form-control" value={formData.academicSession} onChange={handleChange}>
                    <option value="2023/2024">2023/2024</option>
                    <option value="2024/2025">2024/2025</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <div className="search-bar">
                  <Phone className="search-icon" size={18} />
                  <input type="tel" name="phone" className="form-control" placeholder="+234..." value={formData.phone} onChange={handleChange} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                <button className="btn btn-ghost" onClick={() => setStep('identity')}><ArrowLeft size={18} /> Back</button>
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => nextStep('location')}>
                  Next <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 'location' && (
            <div className="animate-slide-up">
              <div className="form-group">
                <label className="form-label">State of Residence</label>
                <div className="search-bar">
                  <MapPin className="search-icon" size={18} />
                  <input type="text" name="stateOfOrigin" className="form-control" placeholder="e.g. Lagos" value={formData.stateOfOrigin} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Full Residential Address</label>
                <div className="search-bar">
                  <MapPin className="search-icon" size={18} />
                  <input type="text" name="address" className="form-control" placeholder="House 12, Example St..." value={formData.address} onChange={handleChange} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                <button className="btn btn-ghost" onClick={() => nextStep('academic')}><ArrowLeft size={18} /> Back</button>
                <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => nextStep('account')}>
                  Final Step <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 'account' && (
            <form onSubmit={handleSubmit} className="animate-slide-up">
              <div className="form-group">
                <label className="form-label">Official Email (Auto-filled)</label>
                <div className="search-bar">
                  <Mail className="search-icon" size={18} />
                  <input type="email" name="email" className="form-control" value={formData.email} readOnly />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Create Password</label>
                <div className="search-bar">
                  <Lock className="search-icon" size={18} />
                  <input type="password" name="password" className="form-control" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="search-bar">
                  <Lock className="search-icon" size={18} />
                  <input type="password" name="confirmPassword" className="form-control" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                <button className="btn btn-ghost" onClick={() => setStep('location')}><ArrowLeft size={18} /> Back</button>
                <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={loading}>
                  {loading ? <Loader2 className="spinner" size={18} /> : 'Complete Registration'}
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="animate-fade-in" style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{ background: 'var(--green-soft)', padding: '20px', borderRadius: '50%' }}>
                  <CheckCircle2 size={64} style={{ color: 'var(--green)' }} />
                </div>
              </div>
              <h2 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '12px' }}>Welcome Aboard!</h2>
              <p style={{ color: 'var(--text-3)', marginBottom: '32px' }}>
                Your ACETEL account has been successfully created. You can now log in to manage your internship logbook.
              </p>
              <Link to="/login" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                Go to Login
              </Link>
            </div>
          )}

          {step !== 'success' && (
            <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.85rem' }}>
              Already registered? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700 }}>Sign In</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
