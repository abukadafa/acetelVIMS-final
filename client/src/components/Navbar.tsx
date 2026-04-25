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
    <nav className="vims-topbar">
      {/* Both logos + institution name together on the LEFT */}
      <div className="vims-topbar-brand">
        <img src="/assets/noun-logo.png"   alt="NOUN"   className="vims-topbar-logo" />
        <img src="/assets/acetel-logo.png" alt="ACETEL" className="vims-topbar-logo" />
        <div className="vims-topbar-text">
          <div className="vims-topbar-title">
            National Open University of Nigeria (NOUN)
          </div>
          <div className="vims-topbar-sub">
            Africa Centre of Excellence for Technology Enhanced Learning — ACETEL
          </div>
        </div>
      </div>

      {/* System name — centre */}
      <div className="vims-topbar-center">
        ACETEL Virtual Internship Management System
      </div>

      {/* Actions — right */}
      <div className="vims-topbar-right">
        <button className="vims-topbar-notif">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="vims-topbar-badge">{unreadCount}</span>
          )}
        </button>
        <div className="vims-topbar-avatar">
          {user?.firstName[0]}{user?.lastName[0]}
        </div>
      </div>
    </nav>
  );
}
