import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, Save, Shield, User, Bell, Globe, Camera, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../lib/api';

export default function SettingsPage() {
  const { user, student } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

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
        phone: formData.phone
      });
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Profile update failed');
    } finally {
      setLoading(false);
    }
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
        newPassword: formData.newPassword
      });
      toast.success('Password changed successfully');
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="card-header" style={{ marginBottom: '32px' }}>
        <h3 className="card-title"><Settings size={20} /> System & Profile Settings</h3>
      </div>

      <div className="grid-2" style={{ gap: '30px', alignItems: 'start' }}>
        {/* Profile Card */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '20px' }}>
             <h4 style={{ margin: 0 }}><User size={18} /> Personal Identity</h4>
          </div>
          
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
             <div style={{ position: 'relative', display: 'inline-block' }}>
                <div className="avatar avatar-square" style={{ width: '80px', height: '80px', fontSize: '1.5rem', borderRadius: '16px' }}>
                   {user?.firstName[0]}{user?.lastName[0]}
                </div>
                <button className="btn btn-sm btn-primary" style={{ position: 'absolute', bottom: '-10px', right: '-10px', width: '32px', height: '32px', borderRadius: '50%', padding: 0 }}>
                   <Camera size={14} />
                </button>
             </div>
             <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: 0 }}>{user?.firstName} {user?.lastName}</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{user?.role?.toUpperCase()} | {student?.matricNumber || 'Official Account'}</div>
             </div>
          </div>

          <form onSubmit={handleUpdateProfile}>
            <div className="grid-2" style={{ gap: '15px' }}>
               <div className="form-group">
                 <label className="form-label">First Name</label>
                 <input type="text" name="firstName" className="form-control" value={formData.firstName} onChange={handleChange} required />
               </div>
               <div className="form-group">
                 <label className="form-label">Last Name</label>
                 <input type="text" name="lastName" className="form-control" value={formData.lastName} onChange={handleChange} required />
               </div>
            </div>
            <div className="form-group">
               <label className="form-label">Official Email</label>
               <input type="email" name="email" className="form-control" value={formData.email} disabled />
            </div>
            <div className="form-group">
               <label className="form-label">Phone Number</label>
               <input type="tel" name="phone" className="form-control" value={formData.phone} onChange={handleChange} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '20px' }} disabled={loading}>
               <Save size={18} /> Save Profile
            </button>
          </form>
        </div>

        {/* Security & System Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
           <div className="card">
              <div className="card-header" style={{ marginBottom: '20px' }}>
                 <h4 style={{ margin: 0 }}><Lock size={18} /> Password & Security</h4>
              </div>
              <form onSubmit={handleChangePassword}>
                 <div className="form-group">
                   <label className="form-label">Current Password</label>
                   <input type="password" name="currentPassword" title="Current Password" placeholder="••••••••" className="form-control" value={formData.currentPassword} onChange={handleChange} required />
                 </div>
                 <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input type="password" name="newPassword" title="New Password" placeholder="••••••••" className="form-control" value={formData.newPassword} onChange={handleChange} required />
                 </div>
                 <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <input type="password" name="confirmPassword" title="Confirm Password" placeholder="••••••••" className="form-control" value={formData.confirmPassword} onChange={handleChange} required />
                 </div>
                 <button type="submit" className="btn btn-ghost btn-lg" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
                    <Shield size={18} /> Update Password
                 </button>
              </form>
           </div>

           <div className="card">
              <div className="card-header" style={{ marginBottom: '20px' }}>
                 <h4 style={{ margin: 0 }}><Bell size={18} /> Communication Preferences</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Email Notifications</div>
                    <input type="checkbox" title="Email Toggle" defaultChecked />
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Real-time Browser Alerts</div>
                    <input type="checkbox" title="Browser Alert Toggle" defaultChecked />
                 </div>
                 <div className="divider"></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Language Interface</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontWeight: 700 }}>
                       <Globe size={14} /> English (NG)
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
