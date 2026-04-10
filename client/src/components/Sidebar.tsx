import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, LayoutDashboard, Calendar, Map, Users, Settings,
  BookOpen, UserCheck, Activity, ChevronLeft, ChevronRight, UserCog, MessageSquare, History, Trash2
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const COLLAPSED_KEY = 'acetel_sidebar_collapsed';

export default function Sidebar() {
  const { user, logout, isRole } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; }
    catch { return false; }
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    // Push a CSS variable onto the root so Layout / main-content adjusts
    document.documentElement.style.setProperty(
      '--sidebar-w',
      collapsed ? '68px' : '260px'
    );
  }, [collapsed]);

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;

  const NavLink = ({
    to, icon: Icon, label,
  }: { to: string; icon: React.ElementType; label: string }) => (
    <Link
      to={to}
      className={`nav-item${isActive(to) ? ' active' : ''}${collapsed ? ' collapsed' : ''}`}
      title={collapsed ? label : undefined}
    >
      <Icon size={18} className="nav-icon" />
      {!collapsed && <span className="nav-label">{label}</span>}
    </Link>
  );

  const NavBtn = ({
    onClick, icon: Icon, label,
  }: { onClick: () => void; icon: React.ElementType; label: string }) => (
    <button
      onClick={onClick}
      className={`nav-item${collapsed ? ' collapsed' : ''}`}
      title={collapsed ? label : undefined}
    >
      <Icon size={18} className="nav-icon" />
      {!collapsed && <span className="nav-label">{label}</span>}
    </button>
  );

  return (
    <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      {/* ── Toggle Button ── */}
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* ── Logo ── */}
      <div className="sidebar-logo" style={{ borderBottom: 'none' }}>
        {!collapsed && (
          <div className="logo-text-wrap" style={{ paddingLeft: '8px' }}>
            <div className="logo-text" style={{ fontSize: '1.2rem' }}>ACETEL</div>
            <div className="logo-sub" style={{ fontSize: '0.68rem', marginTop: '2px' }}>Virtual Internship Management System</div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="sidebar-nav">
        <div className="nav-group">
          {!collapsed && <div className="nav-group-label">Main Menu</div>}
          <NavLink to="/" icon={LayoutDashboard} label="Dashboard" />

          {isRole('student') && (
            <>
              <NavLink to="/logbook"    icon={BookOpen}   label="My Logbook" />
              <NavLink to="/attendance" icon={UserCheck}  label="Attendance" />
            </>
          )}

          {isRole('supervisor') && (
            <>
              <NavLink to="/students" icon={Users}    label="My Students" />
              <NavLink to="/reviews"  icon={Activity} label="Pending Reviews" />
            </>
          )}

          {isRole('prog_coordinator') && (
            <>
              <NavLink to="/analytics"   icon={Activity} label="Programme Analytics" />
              <NavLink to="/all-students" icon={Users}   label="Student Progress" />
            </>
          )}

          {isRole('internship_coordinator') && (
            <>
              <NavLink to="/all-students" icon={Users}   label="Student Progress" />
              <NavLink to="/companies"    icon={Calendar} label="Companies" />
            </>
          )}

          {isRole('ict_support') && (
            <>
              <NavLink to="/analytics"   icon={Activity} label="Technical Monitoring" />
              <NavLink to="/all-students" icon={Users}   label="Student Registry" />
            </>
          )}

          {isRole('admin') && (
            <>
              <NavLink to="/map"          icon={Map}      label="Live Tracking" />
              <NavLink to="/all-students" icon={Users}    label="All Students" />
              <NavLink to="/companies"    icon={Calendar} label="Companies" />
            </>
          )}

          {(isRole('admin', 'prog_coordinator', 'internship_coordinator', 'ict_support')) && (
            <>
              <div className="divider" style={{ margin: '4px 0', opacity: 0.1 }}></div>
              {!collapsed && <div className="nav-group-label" style={{ color: 'var(--primary)', opacity: 0.8 }}>Governance</div>}
              <NavLink to="/users" icon={UserCog} label="User Management" />
              <NavLink to="/audit-trail" icon={History} label="Audit Trail" />
            </>
          )}

          {isRole('admin') && (
            <>
              <NavLink to="/bin" icon={Trash2} label="Recycle Bin" />
            </>
          )}

          <div className="divider" style={{ margin: '8px 0', opacity: 0.1 }}></div>
          <NavLink to="/feedback" icon={MessageSquare} label="Feedback Portal" />
        </div>

        <div className="nav-group">
          {!collapsed && <div className="nav-group-label">Account</div>}
          <NavLink to="/settings" icon={Settings} label="Settings" />
          <NavBtn onClick={logout} icon={LogOut} label="Logout" />
        </div>
      </nav>

      {/* ── Footer / User ── */}
      {!collapsed && (
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.firstName} {user.lastName}</div>
              <div className="sidebar-user-role">
                {user.role === 'prog_coordinator' && 'Programme Coordinator'}
                {user.role === 'internship_coordinator' && 'Internship Coordinator'}
                {user.role === 'ict_support' && 'ICT Support'}
                {user.role === 'admin' && 'Administrator'}
                {user.role === 'supervisor' && 'Supervisor'}
                {user.role === 'student' && 'Student'}
              </div>
              {(user as any).programme?.code && (
                <div style={{ fontSize: '0.65rem', opacity: 0.7, marginTop: 1 }}>
                  📋 {(user as any).programme.code}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collapsed avatar */}
      {collapsed && (
        <div className="sidebar-footer sidebar-footer-collapsed">
          <div className="sidebar-avatar" title={`${user.firstName} ${user.lastName}`}>
            {user.firstName[0]}{user.lastName[0]}
          </div>
        </div>
      )}
    </aside>
  );
}
