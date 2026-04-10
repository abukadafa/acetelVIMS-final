import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../lib/api';
import {
  Trash2, RotateCcw, Search, RefreshCw, Users, Building2,
  Shield, Briefcase, X, AlertTriangle, CheckCircle,
  Upload, FileText, ShieldAlert, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Types ───────────────────────────────────────────── */
type BinTab = 'staff' | 'students' | 'companies';
type BinAction = 'restore' | 'permanent_delete';

interface BinTarget {
  _id: string;
  type: BinTab;
  label: string;
  subtitle?: string;
  deletedAt?: string;
  deleteReason?: string;
}

/* ═══════════════════════════════════════════════════════ */
export default function RecycleBinPage() {
  const [deletedUsers,     setDeletedUsers]     = useState<any[]>([]);
  const [deletedStudents,  setDeletedStudents]  = useState<any[]>([]);
  const [deletedCompanies, setDeletedCompanies] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [binTab,   setBinTab]   = useState<BinTab>('staff');
  const [search,   setSearch]   = useState('');

  /* ── Action Modal State ── */
  const [showActionModal,  setShowActionModal]  = useState(false);
  const [binAction,        setBinAction]        = useState<BinAction>('restore');
  const [binTarget,        setBinTarget]        = useState<BinTarget | null>(null);
  const [reason,           setReason]           = useState('');
  const [memoFile,         setMemoFile]         = useState<File | null>(null);
  const [submitting,       setSubmitting]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Load data ── */
  const loadRecycleBin = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/recycle-bin');
      setDeletedUsers(data.users);
      setDeletedStudents(data.students);
      setDeletedCompanies(data.companies);
    } catch {
      toast.error('Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecycleBin(); }, [loadRecycleBin]);

  /* ── Open action modal ── */
  const openAction = (target: BinTarget, action: BinAction) => {
    setBinTarget(target);
    setBinAction(action);
    setReason('');
    setMemoFile(null);
    setShowActionModal(true);
  };

  /* ── Submit action ── */
  const handleSubmit = async () => {
    if (!binTarget) return;
    if (!reason.trim()) { toast.error('Please provide a reason'); return; }
    if (!memoFile)      { toast.error('An approval memo document is required'); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('reason', reason);
      formData.append('approvalMemo', memoFile);

      let endpoint = '';
      if (binTarget.type === 'staff') {
        endpoint = binAction === 'restore'
          ? `/admin/users/restore/${binTarget._id}`
          : `/admin/users/permanent-delete/${binTarget._id}`;
      } else if (binTarget.type === 'students') {
        endpoint = binAction === 'restore'
          ? `/admin/students/restore/${binTarget._id}`
          : `/admin/students/permanent-delete/${binTarget._id}`;
      } else {
        endpoint = binAction === 'restore'
          ? `/admin/companies/restore/${binTarget._id}`
          : `/admin/companies/permanent-delete/${binTarget._id}`;
      }

      await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(
        binAction === 'restore'
          ? `✅ Record successfully restored to the system`
          : `🗑️ Record permanently deleted from the system`
      );
      setShowActionModal(false);
      loadRecycleBin();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Filtered lists ── */
  const filterFn = (items: any[], tab: BinTab) => {
    if (!search) return items;
    const q = search.toLowerCase();
    if (tab === 'staff')     return items.filter(u => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q));
    if (tab === 'students')  return items.filter(s => `${s.user?.firstName} ${s.user?.lastName} ${s.matricNumber}`.toLowerCase().includes(q));
    if (tab === 'companies') return items.filter(c => c.name?.toLowerCase().includes(q));
    return items;
  };

  const currentList = filterFn(
    binTab === 'staff' ? deletedUsers : binTab === 'students' ? deletedStudents : deletedCompanies,
    binTab
  );

  return (
    <div className="recycle-bin animate-fade">

      {/* ══ Warning Banner ══ */}
      <div className="bin-warning-banner">
        <ShieldAlert size={18} />
        <span>
          All actions in the Recycle Bin are <strong>irreversible</strong> and require an authorised approval memo. Each action is logged in the institutional audit trail.
        </span>
      </div>

      {/* ══ Page Header ══ */}
      <div className="page-hero">
        <div className="page-hero-left">
          <div className="page-hero-icon"><Trash2 size={24} /></div>
          <div>
            <h1 className="page-hero-title">Institutional Recycle Bin</h1>
            <p className="page-hero-sub">Restore or permanently purge soft-deleted staff, students, and internship partners</p>
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={loadRecycleBin} title="Refresh">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* ══ Bin Tabs ══ */}
      <div className="bin-tabs">
        {([
          { key: 'staff',     icon: Shield,    label: 'Staff Members', count: deletedUsers.length },
          { key: 'students',  icon: Users,     label: 'Students',      count: deletedStudents.length },
          { key: 'companies', icon: Building2, label: 'Partners',      count: deletedCompanies.length },
        ] as const).map(({ key, icon: Icon, label, count }) => (
          <button
            key={key}
            className={`bin-tab-btn ${binTab === key ? 'active' : ''}`}
            onClick={() => { setBinTab(key); setSearch(''); }}
            id={`bin-tab-${key}`}
          >
            <Icon size={15} /> {label}
            <span className={`bin-count-badge ${count > 0 ? 'has-items' : ''}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* ══ Search ══ */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: 20 }}>
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input
            className="form-control"
            placeholder={`Search deleted ${binTab}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="bin-search"
          />
        </div>
      </div>

      {/* ══ Data Table ══ */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="page-loader"><div className="spinner spinner-lg" /></div>
        ) : currentList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><CheckCircle size={40} style={{ color: 'var(--success)' }} /></div>
            <div className="empty-title">Recycle Bin is Empty</div>
            <div className="empty-desc">No deleted {binTab} found. All records are active.</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Details</th>
                  <th>Deleted On</th>
                  <th>Delete Reason</th>
                  <th style={{ textAlign: 'right', minWidth: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>

                {/* ── Staff ── */}
                {binTab === 'staff' && currentList.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="sidebar-avatar" style={{ width: 36, height: 36, opacity: 0.6 }}>
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</div>
                          <div style={{ fontSize: '.75rem', color: 'var(--text-3)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-gray" style={{ textTransform: 'uppercase', fontSize: '.65rem' }}>{u.role}</span></td>
                    <td style={{ fontSize: '.8rem', color: 'var(--text-3)' }}>
                      {u.deletedAt ? new Date(u.deletedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ fontSize: '.8rem', fontStyle: 'italic', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.deleteReason || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="bin-action-btns">
                        <button
                          id={`restore-user-${u._id}`}
                          className="btn btn-sm btn-success"
                          onClick={() => openAction({ _id: u._id, type: 'staff', label: `${u.firstName} ${u.lastName}`, subtitle: u.email, deletedAt: u.deletedAt, deleteReason: u.deleteReason }, 'restore')}
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                        <button
                          id={`purge-user-${u._id}`}
                          className="btn btn-sm btn-danger"
                          onClick={() => openAction({ _id: u._id, type: 'staff', label: `${u.firstName} ${u.lastName}`, subtitle: u.email, deletedAt: u.deletedAt, deleteReason: u.deleteReason }, 'permanent_delete')}
                        >
                          <Trash2 size={13} /> Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* ── Students ── */}
                {binTab === 'students' && currentList.map(s => (
                  <tr key={s._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="sidebar-avatar" style={{ width: 36, height: 36, opacity: 0.6 }}>
                          {s.user?.firstName?.[0]}{s.user?.lastName?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.user?.firstName} {s.user?.lastName}</div>
                          <div style={{ fontSize: '.75rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>{s.matricNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-blue" style={{ fontSize: '.65rem' }}>{s.programme?.code || 'N/A'}</span></td>
                    <td style={{ fontSize: '.8rem', color: 'var(--text-3)' }}>
                      {s.deletedAt ? new Date(s.deletedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ fontSize: '.8rem', fontStyle: 'italic' }}>{s.deleteReason || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="bin-action-btns">
                        <button
                          id={`restore-student-${s._id}`}
                          className="btn btn-sm btn-success"
                          onClick={() => openAction({ _id: s._id, type: 'students', label: `${s.user?.firstName} ${s.user?.lastName}`, subtitle: s.matricNumber, deletedAt: s.deletedAt, deleteReason: s.deleteReason }, 'restore')}
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                        <button
                          id={`purge-student-${s._id}`}
                          className="btn btn-sm btn-danger"
                          onClick={() => openAction({ _id: s._id, type: 'students', label: `${s.user?.firstName} ${s.user?.lastName}`, subtitle: s.matricNumber, deletedAt: s.deletedAt, deleteReason: s.deleteReason }, 'permanent_delete')}
                        >
                          <Trash2 size={13} /> Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* ── Companies ── */}
                {binTab === 'companies' && currentList.map(c => (
                  <tr key={c._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="sidebar-avatar" style={{ width: 36, height: 36, background: 'var(--surface-3)', opacity: 0.7, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Briefcase size={16} style={{ color: 'var(--text-3)' }} />
                        </div>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                      </div>
                    </td>
                    <td style={{ fontSize: '.8rem' }}>{c.sector || '—'}</td>
                    <td style={{ fontSize: '.8rem', color: 'var(--text-3)' }}>
                      {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ fontSize: '.8rem', fontStyle: 'italic' }}>{c.deleteReason || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="bin-action-btns">
                        <button
                          id={`restore-company-${c._id}`}
                          className="btn btn-sm btn-success"
                          onClick={() => openAction({ _id: c._id, type: 'companies', label: c.name, subtitle: c.sector, deletedAt: c.deletedAt, deleteReason: c.deleteReason }, 'restore')}
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                        <button
                          id={`purge-company-${c._id}`}
                          className="btn btn-sm btn-danger"
                          onClick={() => openAction({ _id: c._id, type: 'companies', label: c.name, subtitle: c.sector, deletedAt: c.deletedAt, deleteReason: c.deleteReason }, 'permanent_delete')}
                        >
                          <Trash2 size={13} /> Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Action Modal ══ */}
      {showActionModal && binTarget && (
        <div className="modal-overlay" onClick={() => !submitting && setShowActionModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: 520 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="modal-header"
              style={{
                background: binAction === 'restore'
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                color: '#fff',
                borderRadius: '16px 16px 0 0',
                padding: '20px 24px',
              }}
            >
              <div>
                <h2 className="modal-title" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {binAction === 'restore' ? <RotateCcw size={19} /> : <ShieldAlert size={19} />}
                  {binAction === 'restore' ? 'Restore Record' : '⚠️ Permanent Deletion'}
                </h2>
                <p style={{ margin: 0, fontSize: '.8rem', opacity: 0.88, marginTop: 4 }}>
                  {binTarget.label}
                  {binTarget.subtitle && <span style={{ opacity: 0.7 }}> · {binTarget.subtitle}</span>}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                style={{ color: '#fff' }}
                onClick={() => setShowActionModal(false)}
                disabled={submitting}
              ><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Permanent delete warning */}
              {binAction === 'permanent_delete' && (
                <div className="alert" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '.85rem' }}>This action is irreversible</div>
                      <div style={{ fontSize: '.8rem', marginTop: 4, color: 'var(--text-2)', lineHeight: 1.5 }}>
                        Permanently deleting this record will remove all associated data from the system. This cannot be undone. An approved institutional memo is required to proceed.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {binAction === 'restore' && (
                <div className="alert" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Info size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: '.82rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
                      Restoring <strong>{binTarget.label}</strong> will reactivate their account and all associated access. You must provide a valid justification and an authorised approval memo.
                    </div>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className="form-group">
                <label className="form-label">
                  Justification / Reason <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <textarea
                  id="bin-action-reason"
                  className="form-control"
                  rows={3}
                  placeholder={`Provide a detailed reason for ${binAction === 'restore' ? 'restoring' : 'permanently deleting'} this record...`}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '.875rem' }}
                />
              </div>

              {/* Approval Memo Upload */}
              <div className="form-group">
                <label className="form-label">
                  Approval Memo <span style={{ color: 'var(--danger)' }}>*</span>
                  <span className="form-hint" style={{ marginLeft: 8, display: 'inline' }}>(PDF or image, max 5MB)</span>
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={e => setMemoFile(e.target.files?.[0] || null)}
                  id="memo-file-input"
                />
                {memoFile ? (
                  <div className="memo-chosen-file">
                    <FileText size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '.85rem' }}>{memoFile.name}</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-3)' }}>{(memoFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => { setMemoFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                    ><X size={14} /></button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="memo-upload-btn"
                    onClick={() => fileRef.current?.click()}
                    id="upload-memo-btn"
                  >
                    <Upload size={18} />
                    <span>Click to upload approval memo</span>
                    <span style={{ fontSize: '.72rem', opacity: 0.7 }}>PDF, JPG or PNG</span>
                  </button>
                )}
              </div>

            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowActionModal(false)}
                disabled={submitting}
              >Cancel</button>
              <button
                id="confirm-bin-action-btn"
                className={`btn ${binAction === 'restore' ? 'btn-success' : 'btn-danger'}`}
                onClick={handleSubmit}
                disabled={submitting || !reason.trim() || !memoFile}
              >
                {submitting ? (
                  <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Processing…</>
                ) : binAction === 'restore' ? (
                  <><RotateCcw size={14} /> Confirm Restore</>
                ) : (
                  <><Trash2 size={14} /> Confirm Permanent Delete</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Styles ══ */}
      <style>{`
        .bin-warning-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.35);
          border-radius: 10px;
          padding: 12px 18px;
          margin-bottom: 20px;
          font-size: .82rem;
          color: var(--text-2);
        }
        .bin-warning-banner svg { color: #f59e0b; flex-shrink: 0; }

        .bin-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .bin-tab-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 18px;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          background: var(--surface-2);
          color: var(--text-2);
          font-size: .85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s;
        }
        .bin-tab-btn:hover { border-color: var(--primary); color: var(--primary); }
        .bin-tab-btn.active { border-color: var(--primary); background: rgba(99,102,241,0.08); color: var(--primary); }

        .bin-count-badge {
          background: var(--surface-3);
          color: var(--text-3);
          border-radius: 999px;
          padding: 1px 7px;
          font-size: .7rem;
          font-weight: 700;
          min-width: 20px;
          text-align: center;
        }
        .bin-count-badge.has-items { background: rgba(239,68,68,0.15); color: #ef4444; }

        .bin-action-btns {
          display: flex;
          gap: 6px;
          justify-content: flex-end;
        }

        .btn-success {
          background: var(--success, #10b981);
          color: #fff;
          border: none;
        }
        .btn-success:hover { background: #059669; }

        .memo-upload-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 24px 16px;
          border: 2px dashed var(--border);
          border-radius: 12px;
          background: var(--surface-2);
          color: var(--text-3);
          font-size: .875rem;
          cursor: pointer;
          transition: all 0.18s;
        }
        .memo-upload-btn:hover { border-color: var(--primary); color: var(--primary); background: rgba(99,102,241,0.04); }

        .memo-chosen-file {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.3);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
