import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell } from 'lucide-react';
import api from '../lib/api';

export default function Navbar() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      api.get('/notifications').then(({ data }) => setUnreadCount(data.unreadCount));
    }
  }, [user]);

  return (
    <nav className="tms-topbar">
      {/* Left — dual logos */}
      <div className="tms-topbar-center" style={{ gap: '20px' }}>
        <img src="/assets/noun-logo.png" alt="NOUN" className="tms-topbar-logo" />
        <div className="tms-topbar-brand">
          <div className="tms-topbar-title">
            National Open University of Nigeria (NOUN)
          </div>
          <div className="tms-topbar-sub">
            Africa Centre of Excellence for Technology Enhanced Learning — ACETEL
          </div>
        </div>
      </div>

      {/* Center — system name */}
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '0.95rem',
          fontWeight: 800,
          color: '#dc2626',
          letterSpacing: '-0.01em'
        }}>
          ACETEL Virtual Internship Management System
        </div>
      </div>

      {/* Right — logo + actions */}
      <div className="tms-topbar-right">
        <img src="/assets/acetel-logo.png" alt="ACETEL" className="tms-topbar-logo" />

        <div style={{ width: '1px', background: '#e5e7eb', height: '28px', margin: '0 4px' }} />

        <button className="tms-notif-btn" style={{ position: 'relative' }}>
          <Bell size={18} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '4px', right: '4px',
              width: '16px', height: '16px',
              background: '#dc2626', color: '#fff',
              borderRadius: '50%', fontSize: '0.6rem',
              fontWeight: 700, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff'
            }}>
              {unreadCount}
            </span>
          )}
        </button>

        <div className="tms-avatar">
          {user?.firstName[0]}{user?.lastName[0]}
        </div>
      </div>
    </nav>
  );
}
