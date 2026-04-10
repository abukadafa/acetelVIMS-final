import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import {
  Users, Search, Edit2, Trash2, RefreshCw,
  Shield, BookOpen, Wifi, Briefcase, Download,
  History, GraduationCap, Lock, UserPlus, X, AlertTriangle, 
  Eye, EyeOff, Copy, Check, FileText, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReasonModal from '../components/ReasonModal';
import AuditTrailModal from '../components/AuditTrailModal';
import BulkEnrollModal from '../components/BulkEnrollModal';
import { useAuth } from '../context/AuthContext';

/* ─── Types ────────────────────────────────────────────────────── */
type Role = 'admin' | 'prog_coordinator' | 'internship_coordinator' | 'ict_support' | 'supervisor';
type ActiveTab = 'staff' | 'student' | 'matrix';

interface Programme { _id: string; code: string; name: string; level: string; }
interface UserRecord {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  phone?: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  lastLogin?: string;
  createdAt: string;
  programme?: Programme;
}

interface RoleMeta { label: string; color: string; icon: React.ElementType; needsProgramme: boolean; hierarchy: number; }

const ROLE_META: Record<Role, RoleMeta> = {
  admin:                  { label: 'Administrator',          color: 'badge-red',   icon: Shield,    needsProgramme: false, hierarchy: 1 },
  prog_coordinator:       { label: 'Programme Coordinator',  color: 'badge-green', icon: BookOpen,  needsProgramme: true,  hierarchy: 2 },
  internship_coordinator: { label: 'Internship Coordinator', color: 'badge-amber', icon: Briefcase, needsProgramme: false, hierarchy: 3 },
  ict_support:            { label: 'ICT Support',            color: 'badge-blue',  icon: Wifi,      needsProgramme: true,  hierarchy: 4 },
  supervisor:             { label: 'Supervisor',             color: 'badge-gray',  icon: Users,     needsProgramme: false, hierarchy: 5 },
};

const ROLE_DISPLAY_ORDER: Role[] = ['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor'];

/* ─── Empty forms ─────────────────────────────────────────────── */
const emptyStaffForm = () => ({
  firstName: '', lastName: '', email: '', phone: '',
  role: 'prog_coordinator' as Role, programme: '', password: '', isActive: true
});

const emptyStudentForm = () => ({
  firstName: '', lastName: '', email: '', phone: '',
  matricNumber: '', programme: '', password: ''
});

/* ═══════════════════════════════════════════════════════════════ */
export default function UserManagementPage() {
  const { user: authUser, isRole } = useAuth();
  const isAdmin = isRole('admin');
  const isGovRole = isRole('prog_coordinator', 'internship_coordinator', 'ict_support');
  const programmeName = (authUser as any)?.programme?.name;
  const programmeCode = (authUser as any)?.programme?.code;

  const [activeTab, setActiveTab] = useState<ActiveTab>(isAdmin ? 'matrix' : 'staff');
  const [users, setUsers]           = useState<UserRecord[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading]       = useState(true);

  const [search, setSearch]     = useState('');
  const [roleFilter, setRole]   = useState('');

  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<UserRecord | null>(null);
  const [form, setForm]             = useState(emptyStaffForm());
  const [studentForm, setStudentForm] = useState({
    surname: '',
    otherNames: '',
    email: '',
    matricNumber: '',
    programme: '',
    phone: '',
    personalEmail: '',
    gender: 'Male',
    isNigerian: true,
    address: '',
    academicSession: '2024/2025',
    level: 'MSc'
  });
  const [showPw, setShowPw]         = useState(false);
  const [saving, setSaving]         = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);
  const [studentTempCred, setStudentTempCred] = useState<{ name: string; email: string; pass: string; matric: string } | null>(null);

  const [tempCred, setTempCred]     = useState<{ name: string; email: string; pass: string } | null>(null);
  const [copied, setCopied]         = useState(false);

  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonAction, setReasonAction]       = useState<'edit' | 'delete' | null>(null);
  const [reasonTarget, setReasonTarget]       = useState<UserRecord | null>(null);
  const [showAuditTrail, setShowAuditTrail]   = useState<string | null>(null);
  const [showBulkEnroll, setShowBulkEnroll]   = useState(false);

  /* ── Fetch ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string,string> = {};
      if (search)     params.search = search;
      if (roleFilter) params.role   = roleFilter;
      const { data } = await api.get('/admin/users', { params });
      setUsers(data.users);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [search, roleFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/admin/programmes').then(r => setProgrammes(r.data.programmes)).catch(() => {});
  }, []);

  /* ── Modal helpers ── */
  const openCreate = () => { setEditing(null); setForm(emptyStaffForm()); setShowPw(false); setShowModal(true); };
  const openEdit   = (u: UserRecord) => {
    setEditing(u);
    setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone || '',
              role: u.role, programme: u.programme?._id || '', password: '', isActive: u.isActive });
    setShowPw(false);
    setShowModal(true);
  };

  /* ── Save Staff ── */
  const triggerUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      setReasonAction('edit');
      setReasonTarget(editing);
      setShowReasonModal(true);
    } else {
      performSave();
    }
  };

  const performSave = async (reason?: string) => {
    setSaving(true);
    try {
      if (editing) {
        const payload: Record<string, any> = { ...form, reason };
        if (!payload.password) delete payload.password;
        const { data } = await api.put(`/admin/users/${editing._id}`, payload);
        toast.success('User updated');
        if (data.newPassword) setTempCred({ name: `${form.firstName} ${form.lastName}`, email: form.email, pass: data.newPassword });
        setShowModal(false);
        setShowReasonModal(false);
      } else {
        const { data } = await api.post('/admin/users', form);
        toast.success('User created');
        setTempCred({ name: `${form.firstName} ${form.lastName}`, email: form.email, pass: data.tempPassword });
        setShowModal(false);
      }
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save user');
    } finally { setSaving(false); }
  };

  /* ── Save Student ── */
  const handleStudentOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStudent(true);
    try {
      const payload = {
        firstName: studentForm.otherNames,
        lastName: studentForm.surname,
        email: studentForm.email,
        matricNumber: studentForm.matricNumber,
        programme: studentForm.programme || (!isAdmin ? (authUser as any)?.programme?._id : ''),
        phone: studentForm.phone,
        personalEmail: studentForm.personalEmail,
        gender: studentForm.gender,
        isNigerian: studentForm.isNigerian,
        address: studentForm.address,
        academicSession: studentForm.academicSession,
        level: studentForm.level
      };
      const { data } = await api.post('/admin/students', payload);
      toast.success('Student onboarded successfully!');
      setStudentTempCred({
        name: `${studentForm.otherNames} ${studentForm.surname}`,
        email: studentForm.email,
        pass: data.tempPassword,
        matric: studentForm.matricNumber,
      });
      setShowStudentModal(false);
      setStudentForm({
        surname: '', otherNames: '', email: '', matricNumber: '', programme: '', phone: '',
        personalEmail: '', gender: 'Male', isNigerian: true, address: '', academicSession: '2024/2025', level: 'MSc'
      });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to onboard student');
    } finally { setSavingStudent(false); }
  };

  /* ── Delete ── */
  const initiateDelete = (u: UserRecord) => {
    setReasonAction('delete');
    setReasonTarget(u);
    setShowReasonModal(true);
  };

  const handleReasonConfirm = async (reason: string) => {
    if (!reasonTarget) return;
    setSaving(true);
    try {
      if (reasonAction === 'delete') {
        await api.delete(`/admin/users/${reasonTarget._id}`, { data: { reason } });
        toast.success('User moved to recycle bin');
      } else if (reasonAction === 'edit') {
        await performSave(reason);
      }
      setShowReasonModal(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally { setSaving(false); }
  };

  /* ── Copy creds ── */
  const copyCreds = () => {
    if (!tempCred) return;
    navigator.clipboard.writeText(
      `ACETEL Login\nEmail: ${tempCred.email}\nPassword: ${tempCred.pass}\nURL: ${window.location.origin}/login`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyStudentCreds = () => {
    if (!studentTempCred) return;
    navigator.clipboard.writeText(
      `ACETEL Student Login\nName: ${studentTempCred.name}\nMatriculation: ${studentTempCred.matric}\nEmail: ${studentTempCred.email}\nPassword: ${studentTempCred.pass}\nURL: ${window.location.origin}/login`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (endpoint: string, filename: string) => {
    try {
      const { data } = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed. Please check your permissions.');
    }
  };

  const needsProgramme = ROLE_META[form.role]?.needsProgramme ?? false;

  /* ── Sort users by role hierarchy ── */
  const displayedUsers = [...users].sort((a, b) =>
    (ROLE_META[a.role]?.hierarchy ?? 99) - (ROLE_META[b.role]?.hierarchy ?? 99)
  );

  /* ── Role counts ── */
  const roleCounts = ROLE_DISPLAY_ORDER.reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {} as Record<Role, number>);

  return (
    <div className="user-mgmt animate-fade">

      {/* ══ Programme Scope Banner (non-admin) ══ */}
      {isGovRole && programmeName && (
        <div className="programme-scope-banner">
          <div className="programme-scope-inner">
            <div className="programme-scope-icon"><Lock size={16} /></div>
            <div>
              <div className="programme-scope-title">Programme-Scoped View</div>
              <div className="programme-scope-sub">
                You are managing users and data for <strong>{programmeCode} — {programmeName}</strong> only.
                Contact the Institutional Admin for cross-programme access.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Page Header ══ */}
      <div className="page-hero">
        <div className="page-hero-left">
          <div className="page-hero-icon"><Users size={24} /></div>
          <div>
            <h1 className="page-hero-title">
              {isAdmin ? 'User Management' : 'Programme Governance'}
            </h1>
            <p className="page-hero-sub">
              {isAdmin
                ? 'Manage all staff accounts across ACETEL programmes'
                : `Manage staff and students for ${programmeName || 'your programme'}`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Institutional Exports */}
          {(isAdmin || isGovRole) && (
            <div className="dropdown" style={{ position: 'relative' }}>
              <button className="btn btn-outline" style={{ gap: 8 }}>
                <Download size={16} /> Export Reports
              </button>
              <div className="dropdown-menu" style={{ 
                position: 'absolute', right: 0, top: '100%', zIndex: 100, 
                background: 'white', border: '1px solid var(--border)', 
                borderRadius: 8, boxShadow: 'var(--shadow-lg)', padding: 8, 
                width: 220, marginTop: 4 
              }}>
                <button className="dropdown-item" onClick={() => handleExport('/students/export', 'ACETEL_Student_Registry')}>
                  <GraduationCap size={14} /> Student Registry (.csv)
                </button>
                <button className="dropdown-item" onClick={() => handleExport('/feedback/export', 'ACETEL_Feedback_Log')}>
                  <FileText size={14} /> Institutional Feedback (.csv)
                </button>
                <button className="dropdown-item" onClick={() => handleExport('/admin/audit-logs/export', 'ACETEL_Security_Audit')}>
                  <History size={14} /> Security Audit Trail (.csv)
                </button>
              </div>
            </div>
          )}

          <button className="btn btn-outline" onClick={() => setShowBulkEnroll(true)} id="bulk-enroll-btn">
            <Upload size={16} /> Bulk Import
          </button>
          
          <button className="btn btn-secondary" onClick={() => setShowStudentModal(true)} id="add-student-btn">
            <GraduationCap size={16} /> Onboard Student
          </button>
          
          <button className="btn btn-primary" onClick={openCreate} id="add-user-btn">
            <UserPlus size={16} /> Add Staff
          </button>
        </div>
      </div>

      {/* ══ Role Summary Tiles ══ */}
      <div className="role-summary-grid">
        {ROLE_DISPLAY_ORDER.map(r => {
          const meta = ROLE_META[r];
          const Icon = meta.icon;
          const count = roleCounts[r] || 0;
          if (!isAdmin && r === 'admin') return null;
          return (
            <button
              key={r}
              className={`role-tile ${roleFilter === r ? 'role-tile-active' : ''}`}
              onClick={() => setRole(roleFilter === r ? '' : r)}
              id={`filter-${r}`}
            >
              <div className={`role-tile-icon badge ${meta.color}`}>
                <Icon size={14} />
              </div>
              <div className="role-tile-count">{count}</div>
              <div className="role-tile-label">{meta.label}</div>
            </button>
          );
        })}
      </div>

      {/* ══ Tabs ══ */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {isAdmin && (
          <button
            className={`tab-btn ${activeTab === 'matrix' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('matrix')}
            id="tab-matrix"
          >
            <Shield size={15} /> Institutional Access Matrix (Manual Allocation)
          </button>
        )}
        <button
          className={`tab-btn ${activeTab === 'staff' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('staff')}
          id="tab-staff"
        >
          <Users size={15} /> Staff Directory
        </button>
        <button
          className={`tab-btn ${activeTab === 'student' ? 'tab-active' : ''}`}
          onClick={() => { setActiveTab('student'); setShowStudentModal(true); }}
          id="tab-student"
        >
          <GraduationCap size={15} /> Student Onboarding
        </button>
      </div>

      {/* ══ Filters ══ */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24 }}>
        <div className="user-filters">
          <div className="search-bar" style={{ flex: 1 }}>
            <Search size={16} className="search-icon" />
            <input
              id="user-search"
              className="form-control"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="select-wrap">
            <select
              id="role-filter"
              className="form-control form-select"
              value={roleFilter}
              onChange={e => setRole(e.target.value)}
            >
              <option value="">All Roles</option>
              {ROLE_DISPLAY_ORDER
                .filter(r => isAdmin || r !== 'admin')
                .map(r => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))
              }
            </select>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={load} title="Refresh" id="refresh-btn">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ══ Table / Matrix View ══ */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="page-loader"><div className="spinner spinner-lg" /></div>
        ) : displayedUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Users size={40} /></div>
            <div className="empty-title">No users found</div>
            <div className="empty-desc">Add your first staff member or onboard a student to get started.</div>
          </div>
        ) : activeTab === 'staff' ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 185 }}>Institutional Role</th>
                  <th>Staff Member</th>
                  <th>Programme</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Last Login</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map(u => {
                  const meta = ROLE_META[u.role];
                  const Icon = meta?.icon || Users;
                  return (
                    <tr key={u._id}>
                      <td style={{ minWidth: 185 }}>
                        <div className="role-cell">
                          <span className={`badge ${meta?.color || 'badge-gray'}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 10px' }}>
                            <Icon size={11} />
                            {meta?.label || u.role}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="sidebar-avatar" style={{ width: 36, height: 36 }}>{u.firstName[0]}{u.lastName[0]}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{u.firstName} {u.lastName}</div>
                            <div style={{ fontSize: '.75rem', color: 'var(--text-3)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {u.programme ? (
                          <span className="badge badge-outline" style={{ fontSize: '0.72rem' }}>{u.programme.code}</span>
                        ) : 'Global'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-dot ${u.isActive ? 'active' : 'inactive'}`} />
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '.78rem', color: 'var(--text-3)' }}>
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowAuditTrail(u._id)}><History size={14} /></button>
                          
                          {/* Protect Admin Profile from modification */}
                          {u.role !== 'admin' ? (
                            <>
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(u)}><Edit2 size={14} /></button>
                              {isAdmin ? (
                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => initiateDelete(u)}><Trash2 size={14} /></button>
                              ) : (
                                <button className="btn btn-ghost btn-sm btn-icon" disabled title="Only Administrators can delete users" style={{ opacity: 0.35, cursor: 'not-allowed' }}>
                                  <Lock size={14} />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="badge badge-light" style={{ fontSize: '0.65rem' }}>SYSTEM PROTECTED</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ══ ACCESS CONTROL MATRIX ══ */
          <div className="matrix-container" style={{ overflowX: 'auto' }}>
            <table className="matrix-table">
              <thead>
                <tr>
                  <th className="sticky-col">Staff Member</th>
                  {ROLE_DISPLAY_ORDER.map(r => (
                    <th key={r} style={{ textAlign: 'center', minWidth: 140 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        {React.createElement(ROLE_META[r].icon, { size: 14 })}
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>{ROLE_META[r].label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map(u => (
                  <tr key={u._id}>
                    <td className="sticky-col">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="sidebar-avatar" style={{ width: 28, height: 28, fontSize: '10px' }}>{u.firstName[0]}{u.lastName[0]}</div>
                        <div style={{ lineHeight: 1.2 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{u.firstName} {u.lastName}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    {ROLE_DISPLAY_ORDER.map(r => (
                      <td key={r} style={{ textAlign: 'center' }}>
                        <div className="checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={u.role === r}
                            disabled={u.role === 'admin' || r === 'admin'}
                            onChange={() => {
                              if (u.role === r) return;
                              setEditing(u);
                              setForm({ ...form, role: r, firstName: u.firstName, lastName: u.lastName, email: u.email, isActive: u.isActive });
                              setReasonAction('edit');
                              setReasonTarget(u);
                              setShowReasonModal(true);
                            }}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Add Staff Modal ══ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Staff User' : 'Add New Staff Member'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={triggerUpdate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input id="input-firstName" className="form-control" required
                      value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input id="input-lastName" className="form-control" required
                      value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Work Email *</label>
                  <input id="input-email" type="email" className="form-control" required
                    disabled={!!editing}
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  {editing && <span className="form-hint">Email cannot be changed</span>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select id="input-role" className="form-control form-select" required
                      value={form.role}
                      disabled={!isAdmin && !!editing}
                      onChange={e => setForm(f => ({ ...f, role: e.target.value as Role, programme: '' }))}>
                      <option value="">Select role…</option>
                      {(Object.entries(ROLE_META) as [Role, RoleMeta][])
                        .filter(([r]) => r !== 'admin')
                        .map(([r, m]) => <option key={r} value={r}>{m.label}</option>)}
                    </select>
                    {!isAdmin && editing && <span className="form-hint" style={{ color: 'var(--warning)' }}>Role allocation is restricted to administrators.</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input id="input-phone" className="form-control"
                      value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>

                {needsProgramme && (
                  <div className="form-group">
                    <label className="form-label">
                      Programme <span style={{ color: 'var(--danger)' }}>*</span>
                      <span className="form-hint" style={{ marginLeft: 8, display: 'inline' }}>
                        ({ROLE_META[form.role]?.label} must be linked to a programme)
                      </span>
                    </label>
                    <select id="input-programme" className="form-control form-select" required={needsProgramme}
                      value={form.programme}
                      onChange={e => setForm(f => ({ ...f, programme: e.target.value }))}>
                      <option value="">Select programme…</option>
                      {programmes.map(p => (
                        <option key={p._id} value={p._id}>{p.code} — {p.name} ({p.level})</option>
                      ))}
                    </select>
                    {isGovRole && programmeName && (
                      <span className="form-hint" style={{ color: 'var(--warning)' }}>
                        <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />
                        As a coordinator, new users will be linked to your programme automatically.
                      </span>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">
                    {editing ? 'New Password (leave blank to keep current)' : 'Temporary Password'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="input-password"
                      type={showPw ? 'text' : 'password'}
                      className="form-control"
                      placeholder={editing ? 'Leave blank to keep current' : 'Auto-generated if empty'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      style={{ paddingRight: 44 }}
                    />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span className="form-hint">User must change this password after first login.</span>
                </div>

                {editing && (
                  <div className="form-group">
                    <label className="form-label">Account Status</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {[true, false].map(v => (
                        <label key={String(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '.875rem' }}>
                          <input type="radio" name="isActive" checked={form.isActive === v}
                            onChange={() => setForm(f => ({ ...f, isActive: v } as any))} />
                          <span className={`badge ${v ? 'badge-green' : 'badge-red'}`}>{v ? 'Active' : 'Inactive'}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="save-user-btn" disabled={saving}>
                  {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</> : (editing ? 'Save Changes' : 'Create Staff User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ Onboard Student Modal ══ */}
      {showStudentModal && (
        <div className="modal-overlay" onClick={() => { setShowStudentModal(false); setActiveTab('staff'); }}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)', color: '#fff', borderRadius: '16px 16px 0 0', padding: '20px 24px' }}>
              <div>
                <h2 className="modal-title" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GraduationCap size={20} /> Onboard New Student
                </h2>
                {isGovRole && programmeName && (
                  <p style={{ fontSize: '.8rem', opacity: 0.85, marginTop: 4 }}>
                    Student will be enrolled in: <strong>{programmeCode} — {programmeName}</strong>
                  </p>
                )}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowStudentModal(false); setActiveTab('staff'); }} style={{ color: '#fff' }}><X size={18} /></button>
            </div>
             <form onSubmit={handleStudentOnboard}>
               <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
 
                 <div className="form-row">
                   <div className="form-group">
                     <label className="form-label">Surname (Last Name) *</label>
                     <input id="stu-surname" className="form-control" required
                       value={studentForm.surname} onChange={e => setStudentForm(f => ({ ...f, surname: e.target.value }))} />
                   </div>
                   <div className="form-group">
                     <label className="form-label">Other Names *</label>
                     <input id="stu-otherNames" className="form-control" required
                       value={studentForm.otherNames} onChange={e => setStudentForm(f => ({ ...f, otherNames: e.target.value }))} />
                   </div>
                 </div>
 
                 <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Institutional Email *</label>
                    <input id="stu-email" type="email" className="form-control" required
                      value={studentForm.email} onChange={e => setStudentForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Personal Email</label>
                    <input id="stu-personalEmail" type="email" className="form-control"
                      value={studentForm.personalEmail} onChange={e => setStudentForm(f => ({ ...f, personalEmail: e.target.value }))} />
                  </div>
                 </div>
 
                 <div className="form-row">
                   <div className="form-group">
                     <label className="form-label">Matric Number (Primary Login) *</label>
                     <input id="stu-matric" className="form-control" required
                       placeholder="e.g. ACE/23/..."
                       value={studentForm.matricNumber} onChange={e => setStudentForm(f => ({ ...f, matricNumber: e.target.value }))} />
                   </div>
                   <div className="form-group">
                     <label className="form-label">Phone</label>
                     <input id="stu-phone" className="form-control"
                       value={studentForm.phone} onChange={e => setStudentForm(f => ({ ...f, phone: e.target.value }))} />
                   </div>
                 </div>

                 <div className="form-row">
                   <div className="form-group">
                     <label className="form-label">Gender</label>
                     <select className="form-control form-select" value={studentForm.gender} onChange={e => setStudentForm(f => ({ ...f, gender: e.target.value }))}>
                       <option value="Male">Male</option>
                       <option value="Female">Female</option>
                       <option value="Other">Other</option>
                     </select>
                   </div>
                   <div className="form-group">
                     <label className="form-label">Nigerianity</label>
                     <select className="form-control form-select" value={studentForm.isNigerian ? 'Nigerian' : 'Non-Nigerian'} 
                       onChange={e => setStudentForm(f => ({ ...f, isNigerian: e.target.value === 'Nigerian' }))}>
                       <option value="Nigerian">Nigerian</option>
                       <option value="Non-Nigerian">Non-Nigerian</option>
                     </select>
                   </div>
                 </div>

                 <div className="form-group">
                   <label className="form-label">Full Address</label>
                   <textarea className="form-control" style={{ height: 60 }} value={studentForm.address} onChange={e => setStudentForm(f => ({ ...f, address: e.target.value }))} />
                 </div>
 
                 {isAdmin && (
                   <div className="form-group">
                     <label className="form-label">Programme *</label>
                     <select id="stu-programme" className="form-control form-select" required={isAdmin}
                       value={studentForm.programme}
                       onChange={e => setStudentForm(f => ({ ...f, programme: e.target.value }))}>
                       <option value="">Select programme…</option>
                       {programmes.map(p => (
                         <option key={p._id} value={p._id}>{p.code} — {p.name} ({p.level})</option>
                       ))}
                     </select>
                   </div>
                 )}
               </div>
               <div className="modal-footer">
                 <button type="button" className="btn btn-outline" onClick={() => { setShowStudentModal(false); }}>Cancel</button>
                 <button type="submit" className="btn btn-primary" id="save-student-btn" disabled={savingStudent}>
                   {savingStudent ? 'Onboarding…' : 'Finalize Student Onboarding'}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* ══ Staff Temp Credentials Modal ══ */}
      {tempCred && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="modal-title">🎉 Staff User Created</h2>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                Share these credentials securely with <strong>{tempCred.name}</strong>. The password must be changed after first login.
              </div>
              <div className="cred-box">
                <div className="cred-row"><span className="cred-key">Email</span><span className="cred-val">{tempCred.email}</span></div>
                <div className="cred-row"><span className="cred-key">Password</span><span className="cred-val cred-pw">{tempCred.pass}</span></div>
                <div className="cred-row"><span className="cred-key">URL</span><span className="cred-val">{window.location.origin}/login</span></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={copyCreds} id="copy-creds-btn">
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy All</>}
              </button>
              <button className="btn btn-primary" onClick={() => setTempCred(null)} id="close-creds-btn">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Student Temp Credentials Modal ══ */}
      {studentTempCred && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--success) 0%, #10b981 100%)', color: '#fff', borderRadius: '16px 16px 0 0' }}>
              <h2 className="modal-title" style={{ color: '#fff' }}>🎓 Student Onboarded!</h2>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                Share these credentials securely with <strong>{studentTempCred.name}</strong>. The password must be changed after first login.
              </div>
              <div className="cred-box">
                <div className="cred-row"><span className="cred-key">Matric Number (Username)</span><span className="cred-val cred-info">{studentTempCred.matric}</span></div>
                <div className="cred-row"><span className="cred-key">Password</span><span className="cred-val cred-pw">{studentTempCred.pass}</span></div>
                <div className="cred-row"><span className="cred-key">Official Email</span><span className="cred-val">{studentTempCred.email}</span></div>
                <div className="cred-row"><span className="cred-key">URL</span><span className="cred-val">{window.location.origin}/login</span></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={copyStudentCreds} id="copy-stu-creds-btn">
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy All</>}
              </button>
              <button className="btn btn-primary" onClick={() => setStudentTempCred(null)} id="close-stu-creds-btn">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Justification Modal ══ */}
      {showReasonModal && reasonTarget && (
        <ReasonModal
          title={reasonAction === 'delete' ? 'Confirm Deletion' : 'Confirm Edit'}
          message={`Please provide a reason for ${reasonAction === 'delete' ? 'deleting' : 'editing'} ${reasonTarget.firstName} ${reasonTarget.lastName}.`}
          confirmText={reasonAction === 'delete' ? 'Delete' : 'Save Changes'}
          onConfirm={handleReasonConfirm}
          onCancel={() => setShowReasonModal(false)}
          loading={saving}
        />
      )}

      {/* ══ Audit Trail Modal ══ */}
      {showAuditTrail && (
        <AuditTrailModal
          targetId={showAuditTrail}
          title={`Audit Trail: ${displayedUsers.find(u => u._id === showAuditTrail)?.firstName || 'User'}`}
          onClose={() => setShowAuditTrail(null)}
        />
      )}

      {/* ══ Bulk Enroll Modal (NEW) ══ */}
      {showBulkEnroll && (
        <BulkEnrollModal 
          onClose={() => setShowBulkEnroll(false)} 
          onSuccess={() => { setShowBulkEnroll(false); load(); }} 
        />
      )}

      {/* ══ Extra Styles ══ */}
      <style>{`
        .programme-scope-banner {
          background: linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0.04) 100%);
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 12px;
          padding: 14px 20px;
          margin-bottom: 20px;
        }
        .programme-scope-inner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .programme-scope-icon {
          background: rgba(99,102,241,0.2);
          border-radius: 8px;
          padding: 8px;
          color: #6366f1;
          flex-shrink: 0;
          display: flex;
        }
        .programme-scope-title {
          font-size: .8rem;
          font-weight: 700;
          color: #6366f1;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }
        .programme-scope-sub {
          font-size: .82rem;
          color: var(--text-2);
          line-height: 1.4;
        }

        .role-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .role-tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          background: var(--surface-2);
          border: 1.5px solid var(--border);
          border-radius: 14px;
          padding: 14px 10px;
          cursor: pointer;
          transition: all 0.18s;
          text-align: center;
        }
        .role-tile:hover { border-color: var(--primary); transform: translateY(-2px); }
        .role-tile-active { border-color: var(--primary); background: rgba(99,102,241,0.08); }
        .role-tile-icon { display: flex; align-items: center; gap: 4px; }
        .role-tile-count {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text-1);
          line-height: 1;
        }
        .role-tile-label {
          font-size: .68rem;
          color: var(--text-3);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .tab-bar {
          display: flex;
          gap: 6px;
          border-bottom: 2px solid var(--border);
          padding-bottom: 0;
          margin-bottom: 0;
        }
        .tab-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 20px;
          font-size: .85rem;
          font-weight: 600;
          border: none;
          background: none;
          color: var(--text-3);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          transition: all 0.18s;
          border-radius: 8px 8px 0 0;
        }
        .tab-btn:hover { color: var(--text-1); background: var(--surface-2); }
        .tab-active { color: var(--primary) !important; border-bottom-color: var(--primary) !important; }

        .role-cell { display: flex; flex-direction: column; gap: 3px; }
        .programme-cell { display: flex; flex-direction: column; gap: 2px; }

        .switch-sm {
          position: relative;
          display: inline-block;
          width: 32px;
          height: 18px;
        }
        .switch-sm input { opacity: 0; width: 0; height: 0; }
        .slider-round {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: var(--surface-3);
          transition: .4s;
          border-radius: 18px;
        }
        .slider-round:before {
          position: absolute;
          content: "";
          height: 14px; width: 14px;
          left: 2px; bottom: 2px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
        input:checked + .slider-round { background-color: var(--success); }
        input:checked + .slider-round:before { transform: translateX(14px); }

        .badge-outline {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-2);
          display: inline-flex;
          align-items: center;
        }
      `}</style>

    </div>
  );
}
