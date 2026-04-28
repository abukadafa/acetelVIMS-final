import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, LayoutDashboard, Map, Users, Settings,
  BookOpen, UserCheck, Activity, ChevronLeft, ChevronRight,
  UserCog, MessageSquare, History, Trash2, MessageCircle,
  Mail, Shield, Smartphone, Building2, PenSquare,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import ComposeMessage from './ComposeMessage';
import api from '../lib/api';

const COLLAPSED_KEY = 'acetel_sidebar_collapsed';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  supervisor: 'Academic Supervisor',
  industry_supervisor: 'Industry Supervisor',
  prog_coordinator: 'Programme Coordinator',
  internship_coordinator: 'Internship Coordinator',
  ict_support: 'ICT Support',
  student: 'Student',
};

export default function Sidebar() {
  const { user, logout, isRole } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; }
    catch { return false; }
  });
  const [unreadChats, setUnreadChats]           = useState(0);
  const [unreadNotifications, setUnreadNotif]   = useState(0);
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? '68px' : '260px');
  }, [collapsed]);

  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      try {
        const [chatRes, notifRes] = await Promise.all([
          api.get('/chat'),
          api.get('/notifications'),
        ]);
        const unread = (chatRes.data.chats || []).filter((c: any) =>
          c.lastMessageBy && c.lastMessageBy !== user.id
        ).length;
        setUnreadChats(unread);
        setUnreadNotif(notifRes.data.unreadCount || 0);
      } catch { /* silent */ }
    };
    poll();
    const iv = setInterval(poll, 30000);
    return () => clearInterval(iv);
  }, [user]);

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;

  const NavLink = ({
    to, icon: Icon, label, badge,
  }: { to: string; icon: React.ElementType; label: string; badge?: number }) => (
    <Link
      to={to}
      className={`nav-item${isActive(to) ? ' active' : ''}${collapsed ? ' collapsed' : ''}`}
      title={collapsed ? label : undefined}
      style={{ position: 'relative' }}
    >
      <Icon size={18} className="nav-icon" />
      {!collapsed && <span className="nav-label">{label}</span>}
      {badge && badge > 0 && (
        <span style={{
          position: 'absolute', top: '6px', right: collapsed ? '6px' : '12px',
          background: '#ef4444', color: '#fff', borderRadius: '10px',
          fontSize: '10px', fontWeight: 700, padding: '1px 5px',
          minWidth: '16px', textAlign: 'center',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );

  const NavBtn = ({ onClick, icon: Icon, label }: { onClick: () => void; icon: React.ElementType; label: string }) => (
    <button onClick={onClick} className={`nav-item${collapsed ? ' collapsed' : ''}`} title={collapsed ? label : undefined}>
      <Icon size={18} className="nav-icon" />
      {!collapsed && <span className="nav-label">{label}</span>}
    </button>
  );

  const SectionLabel = ({ children }: { children: React.ReactNode }) =>
    !collapsed ? <div className="nav-group-label">{children}</div> : null;

  return (
    <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      <button className="sidebar-toggle" onClick={() => setCollapsed(c => !c)}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="sidebar-logo" style={{ borderBottom: 'none' }}>
        {!collapsed && (
          <div className="logo-text-wrap" style={{ paddingLeft: '8px' }}>
            <div className="logo-text" style={{ fontSize: '1.2rem' }}>ACETEL</div>
            <div className="logo-sub" style={{ fontSize: '0.68rem', marginTop: '2px' }}>Virtual Internship Management</div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {/* ── MAIN MENU ── */}
        <div className="nav-group">
          <SectionLabel>Main</SectionLabel>
          <NavLink to="/" icon={LayoutDashboard} label="Dashboard" />

          {/* Student */}
          {isRole('student') && (
            <>
              <NavLink to="/logbook"    icon={BookOpen}   label="My Logbook" />
              <NavLink to="/attendance" icon={UserCheck}  label="Attendance" />
            </>
          )}

          {/* Industry Supervisor */}
          {isRole('industry_supervisor') && (
            <>
              <NavLink to="/logbook"  icon={BookOpen}  label="Review Logbooks" />
              <NavLink to="/students" icon={Users}     label="My Interns" />
            </>
          )}

          {/* Academic Supervisor */}
          {isRole('supervisor') && (
            <>
              <NavLink to="/students" icon={Users}    label="My Students" />
              <NavLink to="/reviews"  icon={Activity} label="Pending Reviews" />
            </>
          )}

          {/* Programme Coordinator */}
          {isRole('prog_coordinator') && (
            <>
              <NavLink to="/all-students" icon={Users}    label="Student Progress" />
              <NavLink to="/analytics"    icon={Activity} label="Programme Analytics" />
            </>
          )}

          {/* Internship Coordinator */}
          {isRole('internship_coordinator') && (
            <>
              <NavLink to="/all-students" icon={Users}      label="Student Progress" />
              <NavLink to="/companies"    icon={Building2}  label="Partner Companies" />
            </>
          )}

          {/* ICT Support */}
          {isRole('ict_support') && (
            <>
              <NavLink to="/all-students" icon={Users}    label="Student Registry" />
              <NavLink to="/analytics"    icon={Activity} label="Technical Monitoring" />
            </>
          )}

          {/* Admin */}
          {isRole('admin') && (
            <>
              <NavLink to="/map"          icon={Map}        label="Live Tracking" />
              <NavLink to="/all-students" icon={Users}      label="All Students" />
              <NavLink to="/companies"    icon={Building2}  label="Partner Companies" />
              <NavLink to="/analytics"    icon={Activity}   label="Analytics" />
            </>
          )}
        </div>

        {/* ── GOVERNANCE (admin/coordinator only) ── */}
        {isRole('admin', 'prog_coordinator', 'internship_coordinator', 'ict_support') && (
          <div className="nav-group">
            <SectionLabel>Governance</SectionLabel>
            <NavLink to="/users"       icon={UserCog} label="User Management" />
            <NavLink to="/audit-trail" icon={History} label="Audit Trail" />
            {isRole('admin') && <NavLink to="/bin"      icon={Trash2}  label="Recycle Bin" />}
            {isRole('admin') && <NavLink to="/firewall" icon={Shield}  label="Firewall" />}
            {isRole('admin') && <NavLink to="/whatsapp" icon={Smartphone} label="WhatsApp Setup" />}
          </div>
        )}

        {/* ── COMMUNICATION — visible to ALL roles ── */}
        <div className="nav-group">
          <SectionLabel>Communication</SectionLabel>
          <button
            onClick={() => setShowCompose(true)}
            className={`nav-item${collapsed ? ' collapsed' : ''}`}
            title={collapsed ? 'Compose Message' : undefined}
            style={{ background: 'var(--primary)', color: '#fff', borderRadius: '10px', margin: '0 8px 6px', width: collapsed ? '44px' : 'calc(100% - 16px)', justifyContent: 'center' }}
          >
            <PenSquare size={16} className="nav-icon" style={{ color: '#fff' }} />
            {!collapsed && <span className="nav-label" style={{ color: '#fff', fontWeight: 700 }}>Compose</span>}
          </button>
          <NavLink to="/chat"     icon={MessageCircle}  label="Team Chat"       badge={unreadChats} />
          <NavLink to="/email"    icon={Mail}           label="Email Centre" />
          <NavLink to="/feedback" icon={MessageSquare}  label="Feedback Portal" badge={unreadNotifications > 0 ? unreadNotifications : undefined} />
        </div>

        {/* ── ACCOUNT ── */}
        <div className="nav-group">
          <SectionLabel>Account</SectionLabel>
          <NavLink to="/settings" icon={Settings} label="Settings" />
          <NavBtn onClick={logout} icon={LogOut} label="Logout" />
        </div>
      </nav>

      {/* User footer */}
      {!collapsed ? (
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user.firstName[0]}{user.lastName[0]}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.firstName} {user.lastName}</div>
              <div className="sidebar-user-role">{ROLE_LABELS[user.role] || user.role}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="sidebar-footer sidebar-footer-collapsed">
          <div className="sidebar-avatar" title={`${user.firstName} ${user.lastName}`}>
            {user.firstName[0]}{user.lastName[0]}
          </div>
        </div>
      )}
      {showCompose && <ComposeMessage onClose={() => setShowCompose(false)} />}
    </aside>
  );
}
