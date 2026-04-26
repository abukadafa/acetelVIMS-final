import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, LayoutDashboard, Calendar, Map, Users, Settings,
  BookOpen, UserCheck, Activity, ChevronLeft, ChevronRight,
  UserCog, MessageSquare, History, Trash2, Radio, ClipboardCheck
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const COLLAPSED_KEY = 'acetel_sidebar_collapsed';

// ── Inline style constants — guaranteed visible regardless of CSS conflicts
const S = {
  sidebar: (collapsed: boolean): React.CSSProperties => ({
    width: collapsed ? 68 : 260,
    background: 'linear-gradient(180deg, #14532d 0%, #166534 55%, #14532d 100%)',
    position: 'fixed', top: 0, left: 0, height: '100vh',
    display: 'flex', flexDirection: 'column',
    zIndex: 100, boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
    transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
    overflow: 'visible',
  }),
  toggle: (): React.CSSProperties => ({
    position: 'absolute', top: 72, right: -14,
    width: 28, height: 28, borderRadius: '50%',
    background: '#16a34a', color: '#fff',
    border: '2px solid rgba(255,255,255,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', zIndex: 110,
    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
    padding: 0,
  }),
  logo: (): React.CSSProperties => ({
    padding: '22px 18px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.12)',
    display: 'flex', alignItems: 'center', gap: 10,
    overflow: 'hidden', flexShrink: 0,
  }),
  logoTitle: (): React.CSSProperties => ({
    fontFamily: "'Syne', sans-serif",
    fontSize: '1.15rem', fontWeight: 900,
    color: '#ffffff', lineHeight: 1.2, whiteSpace: 'nowrap',
  }),
  logoSub: (): React.CSSProperties => ({
    fontSize: '0.65rem', color: '#bbf7d0',
    fontWeight: 600, marginTop: 2,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  }),
  groupLabel: (): React.CSSProperties => ({
    fontSize: '0.62rem', fontWeight: 800,
    color: '#86efac',
    textTransform: 'uppercase', letterSpacing: '0.13em',
    padding: '12px 20px 5px',
    whiteSpace: 'nowrap',
  }),
  divider: (): React.CSSProperties => ({
    height: 1, background: 'rgba(255,255,255,0.12)',
    margin: '6px 16px',
  }),
  navItem: (active: boolean, collapsed: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center',
    gap: collapsed ? 0 : 11,
    padding: collapsed ? '12px 0' : '10px 16px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    color: active ? '#ffffff' : '#d1fae5',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '0.9rem', fontWeight: active ? 700 : 600,
    background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
    borderLeft: active ? '3px solid #86efac' : '3px solid transparent',
    cursor: 'pointer', width: '100%', textAlign: 'left',
    border: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
    transition: 'all 0.15s ease',
    textDecoration: 'none',
  }),
  footer: (): React.CSSProperties => ({
    padding: '14px 16px',
    borderTop: '1px solid rgba(255,255,255,0.15)',
    flexShrink: 0,
  }),
  footerUser: (): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 12,
  }),
  avatar: (): React.CSSProperties => ({
    width: 36, height: 36, borderRadius: '50%',
    background: '#16a34a', color: '#ffffff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: '0.8rem', flexShrink: 0,
    fontFamily: "'Syne', sans-serif",
  }),
  userName: (): React.CSSProperties => ({
    fontSize: '0.85rem', fontWeight: 800,
    color: '#ffffff', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  }),
  userRole: (): React.CSSProperties => ({
    fontSize: '0.7rem', color: '#bbf7d0',
    fontWeight: 600, textTransform: 'capitalize',
    marginTop: 2,
  }),
};

export default function Sidebar() {
  const { user, logout, isRole } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; }
    catch { return false; }
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? '68px' : '260px');
  }, [collapsed]);

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;

  const NavLink = ({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) => (
    <Link to={to} style={S.navItem(isActive(to), collapsed)} title={collapsed ? label : undefined}>
      <Icon size={18} style={{ flexShrink: 0 }} />
      {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
    </Link>
  );

  const NavBtn = ({ onClick, icon: Icon, label }: { onClick: () => void; icon: React.ElementType; label: string }) => (
    <button onClick={onClick} style={S.navItem(false, collapsed)} title={collapsed ? label : undefined}>
      <Icon size={18} style={{ flexShrink: 0 }} />
      {!collapsed && <span>{label}</span>}
    </button>
  );

  const roleLabel = {
    prog_coordinator: 'Programme Coordinator',
    internship_coordinator: 'Internship Coordinator',
    ict_support: 'ICT Support',
    admin: 'Administrator',
    supervisor: 'Supervisor',
    student: 'Student',
  }[user.role] || user.role;

  return (
    <aside style={S.sidebar(collapsed)}>

      {/* Toggle */}
      <button style={S.toggle()} onClick={() => setCollapsed(c => !c)}>
        {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>

      {/* Logo */}
      <div style={S.logo()}>
        {!collapsed && (
          <div style={{ paddingLeft: 4 }}>
            <div style={S.logoTitle()}>ACETEL</div>
            <div style={S.logoSub()}>Virtual Internship System</div>
          </div>
        )}
        {collapsed && (
          <div style={{ ...S.logoTitle(), fontSize: '1rem', textAlign: 'center', width: '100%' }}>A</div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>

        {/* Main Menu */}
        {!collapsed && <div style={S.groupLabel()}>Main Menu</div>}
        <NavLink to="/" icon={LayoutDashboard} label="Dashboard" />

        {isRole('student') && (
          <>
            <NavLink to="/logbook"    icon={BookOpen}  label="My Logbook" />
            <NavLink to="/attendance" icon={UserCheck} label="Attendance" />
          </>
        )}

        {isRole('supervisor') && (
          <>
            <NavLink to="/students" icon={Users}    label="My Students" />
            <NavLink to="/reviews"  icon={Activity} label="Pending Reviews" />
          </>
        )}

        {isRole('industry_supervisor') && (
          <>
            <NavLink to="/industry-reviews" icon={ClipboardCheck} label="Logbook Reviews" />
            <NavLink to="/students"         icon={Users}          label="My Interns" />
          </>
        )}

        {isRole('prog_coordinator') && (
          <>
            <NavLink to="/analytics"    icon={Activity} label="Programme Analytics" />
            <NavLink to="/all-students" icon={Users}    label="Student Progress" />
          </>
        )}

        {isRole('internship_coordinator') && (
          <>
            <NavLink to="/all-students" icon={Users}    label="Student Progress" />
            <NavLink to="/companies"    icon={Calendar} label="Companies" />
          </>
        )}

        {isRole('ict_support') && (
          <>
            <NavLink to="/analytics"    icon={Activity} label="Technical Monitoring" />
            <NavLink to="/all-students" icon={Users}    label="Student Registry" />
          </>
        )}

        {isRole('admin') && (
          <>
            <NavLink to="/map"          icon={Map}      label="Live Tracking" />
            <NavLink to="/all-students" icon={Users}    label="All Students" />
            <NavLink to="/companies"    icon={Calendar} label="Companies" />
          </>
        )}

        {isRole('admin', 'prog_coordinator', 'internship_coordinator', 'ict_support') && (
          <>
            <div style={S.divider()} />
            {!collapsed && <div style={S.groupLabel()}>Governance</div>}
            <NavLink to="/users"       icon={UserCog} label="User Management" />
            <NavLink to="/audit-trail" icon={History} label="Audit Trail" />
          </>
        )}

        {isRole('admin') && (
          <NavLink to="/bin" icon={Trash2} label="Recycle Bin" />
        )}

        <div style={S.divider()} />
        {!collapsed && <div style={S.groupLabel()}>Communication</div>}
        <NavLink to="/communication" icon={Radio} label="Communication Centre" />
        <NavLink to="/feedback" icon={MessageSquare} label="Feedback Portal" />

        {/* Account */}
        <div style={{ marginTop: 8 }}>
          {!collapsed && <div style={S.groupLabel()}>Account</div>}
          <NavLink to="/settings" icon={Settings} label="Settings" />
          <NavBtn onClick={logout} icon={LogOut} label="Sign Out" />
        </div>
      </nav>

      {/* Footer */}
      {!collapsed ? (
        <div style={S.footer()}>
          <div style={S.footerUser()}>
            <div style={S.avatar()}>{user.firstName[0]}{user.lastName[0]}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={S.userName()}>{user.firstName} {user.lastName}</div>
              <div style={S.userRole()}>{roleLabel}</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ ...S.footer(), display: 'flex', justifyContent: 'center' }}>
          <div style={S.avatar()} title={`${user.firstName} ${user.lastName}`}>
            {user.firstName[0]}{user.lastName[0]}
          </div>
        </div>
      )}
    </aside>
  );
}
