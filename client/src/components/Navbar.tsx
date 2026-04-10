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
    <nav className="branded-topbar">
      <img src="/assets/noun-logo.png" alt="NOUN" className="brand-logo" />
      
      <div className="brand-text-center">
        <div className="brand-text-main">
          National Open University of Nigeria (NOUN) <br />
          Africa Center of Excellence on Technology Enhanced Learning (ACETEL)
        </div>
        <div className="brand-text-sub" style={{ color: '#dc2626', fontSize: '1rem', fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>
          ACETEL Virtual Internship Management System
        </div>
      </div>

      <div className="topbar-right">
        <img src="/assets/acetel-logo.png" alt="ACETEL" className="brand-logo" />
        
        <div className="divider-v" style={{ width: '1px', background: '#dee8de', height: '32px', margin: '0 8px' }}></div>

        <button className="btn-ghost notif-btn">
          <Bell size={20} />
          {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
        </button>

        <div className="sidebar-avatar avatar-sm">
          {user?.firstName[0]}{user?.lastName[0]}
        </div>
      </div>
    </nav>
  );
}
