import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell } from 'lucide-react';
import api from '../lib/api';

export default function Navbar() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNoun, setShowNoun] = useState(true);

  useEffect(() => {
    if (user) {
      api.get('/notifications').then(({ data }) => setUnreadCount(data.unreadCount));
    }
  }, [user]);

  // Crossfade logos every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => setShowNoun(prev => !prev), 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="vims-topbar">
      {/* Left — crossfading logo + institution name */}
      <div className="vims-topbar-left">
        <div className="vims-topbar-logo-wrap">
          <img
            src="/assets/noun-logo.png"
            alt="NOUN"
            className="vims-topbar-logo"
            style={{ opacity: showNoun ? 1 : 0 }}
          />
          <img
            src="/assets/acetel-logo.png"
            alt="ACETEL"
            className="vims-topbar-logo"
            style={{ opacity: showNoun ? 0 : 1 }}
          />
        </div>
        <div className="vims-topbar-text">
          <div className="vims-topbar-inst">
            {showNoun
              ? 'National Open University of Nigeria (NOUN)'
              : 'Africa Centre of Excellence for Technology Enhanced Learning'}
          </div>
          <div className="vims-topbar-sub">
            {showNoun ? 'ACETEL — Virtual Internship Management System' : 'ACETEL VIMS'}
          </div>
        </div>
      </div>

      {/* Centre — system name */}
      <div className="vims-topbar-center">
        ACETEL Virtual Internship Management System
      </div>

      {/* Right — bell + avatar */}
      <div className="vims-topbar-right">
        <button className="vims-topbar-bell">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="vims-topbar-badge">{unreadCount}</span>
          )}
        </button>
        <div className="vims-topbar-avatar">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
      </div>
    </nav>
  );
}
