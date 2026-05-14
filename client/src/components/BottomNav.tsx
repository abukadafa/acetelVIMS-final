import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, BookOpen, UserCheck, MessageSquare, Shield, Users } from 'lucide-react';

export default function BottomNav() {
  const { user, isRole } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <Link to={to} className={`mobile-nav-item ${isActive(to) ? 'active' : ''}`}>
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );

  return (
    <nav className="mobile-nav animate-slide-up">
      <NavItem to="/" icon={LayoutDashboard} label="Home" />
      
      {isRole('student') && (
        <>
          <NavItem to="/logbook" icon={BookOpen} label="Log" />
          <NavItem to="/attendance" icon={UserCheck} label="Check-In" />
        </>
      )}

      {isRole('supervisor') && (
        <>
          <NavItem to="/students" icon={Users} label="Students" />
        </>
      )}

      {isRole('admin') && (
        <>
          <NavItem to="/users" icon={Shield} label="Admin" />
        </>
      )}

      <NavItem to="/feedback" icon={MessageSquare} label="Support" />

      <style>{`
        .mobile-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 64px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: space-around;
          align-items: center;
          z-index: 1000;
          padding-bottom: env(safe-area-inset-bottom);
          box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
        }

        @media (min-width: 769px) {
          .mobile-nav { display: none; }
        }

        .mobile-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          color: var(--text-3);
          text-decoration: none;
          flex: 1;
          transition: all 0.2s;
        }

        .mobile-nav-item span {
          font-size: 0.65rem;
          font-weight: 600;
        }

        .mobile-nav-item.active {
          color: var(--primary);
        }

        .mobile-nav-item.active svg {
          transform: translateY(-2px);
          color: var(--primary);
        }
      `}</style>
    </nav>
  );
}
