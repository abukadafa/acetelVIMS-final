import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Download, UserPlus, MoreVertical, Mail, MessageSquare, Eye, UserCheck, AlertTriangle, Pencil, Trash2, History } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import AuditTrailModal from './AuditTrailModal';
import ReasonModal from './ReasonModal';

export default function StudentList() {
  const [students, setStudents]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [programmes, setProgrammes]   = useState<any[]>([]);
  const [filterProgramme, setFilter]  = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [openMenu, setOpenMenu]       = useState<string | null>(null);
  const [editing, setEditing]         = useState<any | null>(null);
  const [auditTarget, setAuditTarget] = useState<{ targetId?: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [newStudent, setNewStudent]   = useState({
    firstName: '', lastName: '', email: '', matricNumber: '',
    phone: '', programme: '',
    personalEmail: '',
    gender: 'Male',
    isNigerian: true,
    address: '',
  });
  const menuRef = useRef<HTMLTableDataCellElement>(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [studRes, progRes] = await Promise.all([
        api.get('/students', { params: { programme: filterProgramme, search } }),
        api.get('/students/programmes'),
      ]);
      setStudents(studRes.data.students || []);
      setProgrammes(progRes.data.programmes || []);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  }, [filterProgramme, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/admin/students', newStudent);
      toast.success('Student enrolled successfully');
      toast.success('Login details sent automatically via Email and WhatsApp (if phone was provided).');
      setShowAddModal(false);
      setNewStudent({
        firstName: '', lastName: '', email: '', matricNumber: '',
        phone: '', programme: '', personalEmail: '', gender: 'Male', isNigerian: true, address: '',
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to enroll student');
    } finally { setSubmitting(false); }
  };

  const handleAction = async (action: string, student: any) => {
    setOpenMenu(null);
    switch (action) {
      case 'view':
        navigate(`/all-students/${student._id}`);
        break;
      case 'email':
        try {
          await api.post('/notifications/send', {
            recipientId: student.user?._id || student.user,
            subject: 'Message from ACETEL',
            body: 'Please log in to ACETEL VIMS to check important updates.',
            channel: 'email',
          });
          toast.success(`Email sent to ${student.user?.firstName || 'student'}`);
        } catch { toast.error('Failed to send email'); }
        break;
      case 'whatsapp':
        try {
          await api.post('/notifications/send', {
            recipientId: student.user?._id || student.user,
            body: 'ACETEL VIMS: Please log in to check important updates.',
            channel: 'whatsapp',
          });
          toast.success('WhatsApp notification sent');
        } catch { toast.error('Failed to send WhatsApp'); }
        break;
      case 'allocate':
        try {
          await api.post(`/students/${student._id}/allocate`);
          toast.success('Student auto-allocated to nearest partner');
          fetchData();
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Auto-allocation failed');
        }
        break;
      case 'flag':
        try {
          await api.post(`/students/${student._id}/flag`);
          toast.success('Student flagged for review');
          fetchData();
        } catch { toast.error('Failed to flag student'); }
        break;
      case 'edit':
        setEditing(student);
        break;
      case 'delete':
        setDeleteTarget(student);
        break;
      case 'audit':
        setAuditTarget({
          targetId: student.user?._id || student.user,
          title: `Audit Trail — ${student.user?.firstName || ''} ${student.user?.lastName || ''}`.trim(),
        });
        break;
    }
  };

  const getRiskBadge = (score: number) => {
    if (score > 70) return <span className="badge badge-red">High Risk</span>;
    if (score > 30) return <span className="badge badge-amber">Medium Risk</span>;
    return <span className="badge badge-green">Low Risk</span>;
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: '0.88rem', outline: 'none', background: '#f9fafb',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/students/export', {
        responseType: 'blob',
        params: { programme: filterProgramme || undefined, search: search || undefined },
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Students_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Export failed');
    }
  };

  return (
    <div className="card animate-fade-in">
      {/* Header */}
      <div className="card-header" style={{ marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h3 className="card-title"><UserPlus size={20} /> Active Students</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-sm btn-ghost"
            onClick={handleExport}>
            <Download size={15} /> Export CSV
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowAddModal(true)}>
            <UserPlus size={15} /> Enroll Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={e => { e.preventDefault(); fetchData(); }}
        style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="search-bar">
            <Search className="search-icon" size={18} />
            <input type="text" className="form-control" placeholder="Search name, matric, email..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <select className="form-control" style={{ width: 'auto', minWidth: 200 }}
          value={filterProgramme} onChange={e => setFilter(e.target.value)}>
          <option value="">All Programmes</option>
          {programmes.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <button type="submit" className="btn btn-ghost">Search</button>
        <button type="button" className="btn btn-ghost"
          onClick={() => { setSearch(''); setFilter(''); setTimeout(fetchData, 0); }}>Clear</button>
      </form>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Student</th><th>Matric No.</th><th>Programme</th>
              <th>Company</th><th>Status</th><th>Risk</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No students found</td></tr>
            ) : students.map(s => (
              <tr key={s._id}>
                <td>
                  <div style={{ fontWeight: 700, color: '#111827' }}>
                    {s.user?.firstName} {s.user?.lastName}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{s.user?.email}</div>
                </td>
                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.matricNumber}</td>
                <td>{s.programme?.name || '—'}</td>
                <td>{s.company?.name || <span style={{ color: '#f59e0b', fontWeight: 600 }}>Unassigned</span>}</td>
                <td>
                  <span className={`badge badge-${s.status === 'active' ? 'green' : s.status === 'completed' ? 'blue' : 'amber'}`}>
                    {s.status || 'pending'}
                  </span>
                </td>
                <td>{getRiskBadge(s.riskScore || 0)}</td>
                <td style={{ position: 'relative' }} ref={openMenu === s._id ? menuRef : undefined}>
                  <button className="btn btn-sm btn-ghost"
                    onClick={() => setOpenMenu(openMenu === s._id ? null : s._id)}>
                    <MoreVertical size={15} />
                  </button>
                  {openMenu === s._id && (
                    <div style={{
                      position: 'absolute', right: 0, top: '100%', zIndex: 200,
                      background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, overflow: 'hidden',
                    }}>
                      {[
                        { action: 'view',     icon: Eye,         label: 'View Profile' },
                        { action: 'email',    icon: Mail,        label: 'Send Email' },
                        { action: 'whatsapp', icon: MessageSquare, label: 'Send WhatsApp' },
                        { action: 'allocate', icon: UserCheck,   label: 'Auto-Allocate' },
                        { action: 'flag',     icon: AlertTriangle, label: 'Flag for Review' },
                        { action: 'edit',     icon: Pencil,      label: 'Edit Student' },
                        { action: 'audit',    icon: History,     label: 'Audit Trail' },
                        { action: 'delete',   icon: Trash2,      label: 'Deactivate' },
                      ].map(({ action, icon: Icon, label }) => (
                        <button key={action} onClick={() => handleAction(action, s)}
                          style={{
                            width: '100%', padding: '10px 16px', background: 'none',
                            border: 'none', display: 'flex', alignItems: 'center', gap: 10,
                            cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                            color: action === 'flag' || action === 'delete' ? '#dc2626' : '#111827',
                            textAlign: 'left', transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          <Icon size={15} color={action === 'flag' || action === 'delete' ? '#dc2626' : '#166534'} />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Enroll Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%',
            maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative' }}>
            <button onClick={() => setShowAddModal(false)} style={{ position: 'absolute',
              top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.2rem', color: '#6b7280' }}>✕</button>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.3rem', fontWeight: 800,
              color: '#111827', marginBottom: 6 }}>Enroll New Student</h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 24 }}>
              Student will receive login credentials via email and WhatsApp automatically
            </p>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { name: 'firstName', label: 'First Name', placeholder: 'Amina', required: true },
                { name: 'lastName',  label: 'Last Name',  placeholder: 'Ibrahim', required: true },
                { name: 'email',     label: 'Institutional Email', placeholder: 'student@noun.edu.ng', required: true, type: 'email' },
                { name: 'personalEmail', label: 'Personal Email (optional)', placeholder: 'student@gmail.com', required: false, type: 'email' },
                { name: 'matricNumber', label: 'Matric Number (Username)', placeholder: 'ACE24240010', required: true },
                { name: 'phone',     label: 'Phone (WhatsApp)', placeholder: '+234...', required: false, type: 'tel' },
              ].map(f => (
                <div key={f.name}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151',
                    marginBottom: 5, display: 'block' }}>{f.label}{f.required && ' *'}</label>
                  <input style={inputStyle} required={f.required} placeholder={f.placeholder} type={(f as any).type || 'text'}
                    value={(newStudent as any)[f.name]}
                    onChange={e => setNewStudent(prev => ({ ...prev, [f.name]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151',
                  marginBottom: 5, display: 'block' }}>Programme *</label>
                <select style={inputStyle} required value={newStudent.programme}
                  onChange={e => setNewStudent(prev => ({ ...prev, programme: e.target.value }))}>
                  <option value="">Select Programme</option>
                  {programmes.map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151',
                  marginBottom: 5, display: 'block' }}>Gender</label>
                <select style={inputStyle} value={newStudent.gender}
                  onChange={e => setNewStudent(prev => ({ ...prev, gender: e.target.value }))}>
                  {['Male', 'Female', 'Other'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151',
                  marginBottom: 5, display: 'block' }}>Nationality</label>
                <select style={inputStyle} value={String(newStudent.isNigerian)}
                  onChange={e => setNewStudent(prev => ({ ...prev, isNigerian: e.target.value === 'true' }))}>
                  <option value="true">Nigerian</option>
                  <option value="false">Non-Nigerian</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151',
                  marginBottom: 5, display: 'block' }}>Full Address</label>
                <input style={inputStyle} placeholder="Full residential address" value={newStudent.address}
                  onChange={e => setNewStudent(prev => ({ ...prev, address: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, padding: 12, border: '1.5px solid #e5e7eb', borderRadius: 8,
                    fontWeight: 600, background: '#fff', cursor: 'pointer', color: '#374151' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  style={{ flex: 2, padding: 12, background: '#166534', color: '#fff',
                    border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
                    opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Enrolling...' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 320, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%',
            maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative' }}>
            <button onClick={() => setEditing(null)} style={{ position: 'absolute',
              top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.2rem', color: '#6b7280' }}>✕</button>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.25rem', fontWeight: 800,
              color: '#111827', marginBottom: 6 }}>
              Edit Student
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 18 }}>
              Update academic verification and placement fields.
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              try {
                await api.put(`/students/${editing._id}`, {
                  status: editing.status,
                  personalEmail: editing.personalEmail,
                  stateOfOrigin: editing.stateOfOrigin,
                  lga: editing.lga,
                  address: editing.address,
                });
                toast.success('Student updated');
                setEditing(null);
                fetchData();
              } catch (err: any) {
                toast.error(err.response?.data?.error || 'Failed to update student');
              } finally { setSubmitting(false); }
            }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5, display: 'block' }}>Status</label>
                <select style={inputStyle} value={editing.status || 'pending'}
                  onChange={e => setEditing((p: any) => ({ ...p, status: e.target.value }))}>
                  {['pending', 'active', 'completed', 'withdrawn', 'suspended'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5, display: 'block' }}>Personal Email</label>
                <input style={inputStyle} type="email" value={editing.personalEmail || ''}
                  onChange={e => setEditing((p: any) => ({ ...p, personalEmail: e.target.value }))}
                  placeholder="student@gmail.com" />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5, display: 'block' }}>State of Origin</label>
                <input style={inputStyle} value={editing.stateOfOrigin || ''}
                  onChange={e => setEditing((p: any) => ({ ...p, stateOfOrigin: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5, display: 'block' }}>LGA</label>
                <input style={inputStyle} value={editing.lga || ''}
                  onChange={e => setEditing((p: any) => ({ ...p, lga: e.target.value }))} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5, display: 'block' }}>Address</label>
                <input style={inputStyle} value={editing.address || ''}
                  onChange={e => setEditing((p: any) => ({ ...p, address: e.target.value }))} />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: 12, marginTop: 6 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1 }}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {auditTarget && (
        <AuditTrailModal
          targetId={auditTarget.targetId}
          title={auditTarget.title}
          onClose={() => setAuditTarget(null)}
        />
      )}

      {deleteTarget && (
        <ReasonModal
          title="Deactivate student account?"
          message={`Provide a reason for deactivating ${deleteTarget.user?.firstName || 'this student'}. This will be logged in the audit trail.`}
          confirmText="Deactivate"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async (reason) => {
            try {
              await api.delete(`/students/${deleteTarget._id}`, { data: { reason } });
              toast.success('Student deactivated');
              setDeleteTarget(null);
              fetchData();
            } catch (err: any) {
              toast.error(err.response?.data?.error || 'Failed to deactivate student');
            }
          }}
        />
      )}
    </div>
  );
}
