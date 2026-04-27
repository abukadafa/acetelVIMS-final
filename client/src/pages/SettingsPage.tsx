import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Settings, Save, Shield, User, Bell, Globe, Camera, Lock,
  MessageCircle, Mail, CheckCircle, XCircle, Smartphone,
  Phone, AlertCircle, ExternalLink, Wifi,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../lib/api';

interface CommsStatus {
  email:    { active: boolean; provider: string | null; };
  whatsapp: { active: boolean; provider: string | null; };
  chat:     { active: boolean; provider: string | null; };
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
      background: active ? '#dcfce7' : '#fee2e2',
      color: active ? '#16a34a' : '#dc2626',
    }}>
      {active
        ? <CheckCircle size={11} />
        : <XCircle size={11} />
      }
      {label}
    </span>
  );
}

export default function SettingsPage() {
  const { user, student, isRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [comms, setComms] = useState<CommsStatus | null>(null);
  const [commsLoading, setCommsLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    api.get('/auth/comms-status')
      .then(r => setComms(r.data))
      .catch(() => {})
      .finally(() => setCommsLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/auth/profile', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
      });
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Profile update failed');
    } finally { setLoading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    setLoading(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      toast.success('Password changed successfully');
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Password change failed');
    } finally { setLoading(false); }
  };

  const CHANNEL_DEFS = [
    {
      key: 'chat',
      icon: MessageCircle,
      label: 'Real-Time Chat',
      color: '#0a5c36',
      description: 'In-app instant messaging between students and staff',
      howTo: null,
    },
    {
      key: 'email',
      icon: Mail,
      label: 'Email Notifications',
      color: '#3b82f6',
      description: 'Automated ACETEL-branded emails for placements, logbook alerts, feedback replies and more',
      howTo: comms?.email.active ? null : 'Add SMTP_USER and SMTP_PASS to your Render backend ENV to activate',
    },
    {
      key: 'whatsapp',
      icon: Smartphone,
      label: 'WhatsApp Notifications',
      color: '#25D366',
      description: 'Instant WhatsApp messages for placements, inactivity alerts, feedback replies and chat pings via Twilio',
      howTo: comms?.whatsapp.active ? null : 'Go to WhatsApp Setup (admin sidebar) for free Meta Cloud API setup instructions.',
    },
  ];

  return (
    <div className="page-container animate-fade">
      <div className="page-header" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your profile, security and communication preferences</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Profile card */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <User size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Personal Identity</h3>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 700 }}>
                  {user?.firstName[0]}{user?.lastName[0]}
                </div>
                <button className="btn btn-sm btn-primary" style={{ position: 'absolute', bottom: '-10px', right: '-10px', width: '30px', height: '30px', borderRadius: '50%', padding: 0 }}>
                  <Camera size={13} />
                </button>
              </div>
              <div style={{ marginTop: '18px' }}>
                <h4 style={{ margin: '0 0 4px' }}>{user?.firstName} {user?.lastName}</h4>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {user?.role?.replace(/_/g, ' ')} {student?.matricNumber ? `· ${student.matricNumber}` : ''}
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input type="text" name="firstName" className="form-input" value={formData.firstName} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input type="text" name="lastName" className="form-input" value={formData.lastName} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Official Email</label>
                <input type="email" name="email" className="form-input" value={formData.email} disabled style={{ opacity: 0.6 }} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={13} /> Phone Number
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 400 }}>— used for WhatsApp alerts</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+234 800 000 0000"
                />
                {!formData.phone && (
                  <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlertCircle size={12} /> Add your phone number to receive WhatsApp notifications
                  </p>
                )}
                {formData.phone && comms?.whatsapp.active && (
                  <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle size={12} /> WhatsApp alerts will be sent to this number
                  </p>
                )}
                {formData.phone && !comms?.whatsapp.active && (
                  <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <XCircle size={12} /> WhatsApp is not yet configured by your administrator
                  </p>
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
                <Save size={16} /> {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>

          {/* Password card */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <Lock size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Password & Security</h3>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" name="currentPassword" className="form-input" placeholder="••••••••" value={formData.currentPassword} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" name="newPassword" className="form-input" placeholder="••••••••" value={formData.newPassword} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" name="confirmPassword" className="form-input" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} required />
              </div>
              <button type="submit" className="btn btn-outline" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
                <Shield size={16} /> Update Password
              </button>
            </form>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Communication Channels Status card */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Wifi size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Communication Channels</h3>
            </div>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-3)' }}>
              These channels deliver notifications, alerts and messages to all users on ACETEL IMS.
            </p>

            {commsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><div className="spinner" /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {CHANNEL_DEFS.map(ch => {
                  const status = comms?.[ch.key as keyof CommsStatus];
                  const Icon = ch.icon;
                  const isActive = status?.active ?? false;
                  return (
                    <div key={ch.key} style={{
                      border: `1.5px solid ${isActive ? ch.color + '40' : 'var(--border)'}`,
                      borderRadius: '12px',
                      padding: '16px 18px',
                      background: isActive ? ch.color + '08' : '#fafafa',
                      transition: 'all 0.2s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: isActive ? ch.color : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={18} color={isActive ? '#fff' : '#9ca3af'} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>{ch.label}</div>
                            {status?.provider && (
                              <div style={{ fontSize: '11px', color: ch.color, fontWeight: 600, marginTop: '1px' }}>{status.provider}</div>
                            )}
                          </div>
                        </div>
                        <StatusBadge active={isActive} label={isActive ? 'Active' : 'Inactive'} />
                      </div>

                      <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.5' }}>
                        {ch.description}
                      </p>

                      {!isActive && ch.howTo && isRole('admin') && (
                        <div style={{ marginTop: '10px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#92400e', display: 'flex', gap: '8px' }}>
                          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                          <span>{ch.howTo}</span>
                        </div>
                      )}

                      {!isActive && !isRole('admin') && ch.key !== 'chat' && (
                        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-3)' }}>
                          Contact your administrator to enable this channel.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* WhatsApp deep-dive card */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Smartphone size={18} style={{ color: '#25D366' }} />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>WhatsApp Notifications</h3>
              {!commsLoading && <StatusBadge active={!!comms?.whatsapp.active} label={comms?.whatsapp.active ? 'Active' : 'Not configured'} />}
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-3)', lineHeight: '1.6' }}>
              When active, you will receive WhatsApp messages for:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {[
                { icon: '🏢', text: 'Internship placement confirmation' },
                { icon: '📝', text: 'Daily logbook reminders' },
                { icon: '⚠️', text: 'Inactivity warnings (after 3+ missed days)' },
                { icon: '💬', text: 'Feedback ticket replies' },
                { icon: '🔔', text: 'New chat messages when you\'re offline' },
                { icon: '🛡️', text: 'Account security alerts' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text)', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>

            <div style={{ background: formData.phone ? (comms?.whatsapp.active ? '#f0fdf4' : '#f9fafb') : '#fff7ed', border: `1px solid ${formData.phone ? (comms?.whatsapp.active ? '#bbf7d0' : '#e5e7eb') : '#fed7aa'}`, borderRadius: '10px', padding: '14px 16px' }}>
              {!formData.phone && (
                <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#92400e' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <strong>Phone number required</strong><br />
                    <span style={{ color: '#b45309' }}>Add your WhatsApp number in your profile (left panel) to receive notifications.</span>
                  </div>
                </div>
              )}
              {formData.phone && !comms?.whatsapp.active && (
                <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#6b7280' }}>
                  <XCircle size={15} style={{ flexShrink: 0, marginTop: '1px', color: '#dc2626' }} />
                  <div>
                    <strong style={{ color: 'var(--text)' }}>WhatsApp not yet enabled</strong><br />
                    Your phone number is saved. Once your administrator activates Twilio WhatsApp, you will start receiving alerts automatically.
                  </div>
                </div>
              )}
              {formData.phone && comms?.whatsapp.active && (
                <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#15803d' }}>
                  <CheckCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <strong>WhatsApp active</strong><br />
                    Alerts will be delivered to <strong>{formData.phone}</strong>
                  </div>
                </div>
              )}
            </div>

            {isRole('admin') && !comms?.whatsapp.active && (
              <a
                href="https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn-more"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
                style={{ marginTop: '14px', color: '#25D366', borderColor: '#25D366', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ExternalLink size={13} /> Set up Twilio WhatsApp →
              </a>
            )}
          </div>

          {/* Notification prefs */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Bell size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Notification Preferences</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'In-app notifications', sub: 'Real-time alerts in the portal', defaultOn: true },
                { label: 'Email notifications', sub: 'ACETEL-branded emails to your inbox', defaultOn: true },
                { label: 'WhatsApp alerts', sub: comms?.whatsapp.active ? 'Active — messages sent to your phone' : 'Pending activation by administrator', defaultOn: !!comms?.whatsapp.active },
                { label: 'Browser push alerts', sub: 'Desktop/mobile browser notifications', defaultOn: false },
              ].map((pref, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--surface-2)', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{pref.label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>{pref.sub}</div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: 0 }}>
                    <input type="checkbox" defaultChecked={pref.defaultOn} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      background: pref.defaultOn ? 'var(--primary)' : '#d1d5db',
                      borderRadius: '22px', transition: '0.3s',
                    }}>
                      <span style={{
                        position: 'absolute', content: '""',
                        height: '16px', width: '16px', left: pref.defaultOn ? '21px' : '3px',
                        bottom: '3px', background: '#fff',
                        borderRadius: '50%', transition: '0.3s',
                      }} />
                    </span>
                  </label>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px', padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', fontSize: '12px', color: '#3b82f6' }}>
              <Globe size={12} /> Interface language: <strong>English (NG)</strong>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
