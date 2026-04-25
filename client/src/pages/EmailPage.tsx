import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import {
  Mail, Send, Clock, CheckCircle, AlertCircle, Users,
  ChevronDown, Search, X, Loader, Eye, RefreshCw, Info,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Contact { _id: string; firstName: string; lastName: string; email: string; role: string; }
interface Programme { _id: string; name: string; code: string; }
interface SentEmail {
  _id: string;
  subject: string;
  body: string;
  recipientScope: string;
  sentCount: number;
  failedCount: number;
  status: 'sending' | 'sent' | 'failed' | 'partial';
  recipients: { name: string; email: string; }[];
  sender: { firstName: string; lastName: string; role: string; };
  programme?: { name: string; };
  createdAt: string;
}

const ALL_SCOPE_LABELS: Record<string, string> = {
  individual: 'Specific Person(s)',
  all_students: 'All Students',
  all_staff: 'All Staff Members',
  programme: 'Programme Group',
  custom: 'Custom Selection',
};

// Students only get individual scope
const STUDENT_SCOPE_LABELS: Record<string, string> = {
  individual: 'Specific Person(s)',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator', supervisor: 'Supervisor',
  prog_coordinator: 'Programme Coordinator',
  internship_coordinator: 'Internship Coordinator',
  ict_support: 'ICT Support', student: 'Student',
};

const STATUS_CONFIG = {
  sent:     { color: '#16a34a', bg: '#dcfce7', icon: CheckCircle, label: 'Sent' },
  sending:  { color: '#2563eb', bg: '#dbeafe', icon: Loader,       label: 'Sending' },
  partial:  { color: '#d97706', bg: '#fef3c7', icon: AlertCircle,  label: 'Partial' },
  failed:   { color: '#dc2626', bg: '#fee2e2', icon: AlertCircle,  label: 'Failed' },
};

export default function EmailPage() {
  const { isRole } = useAuth();
  const [tab, setTab] = useState<'compose' | 'history'>('compose');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [history, setHistory] = useState<SentEmail[]>([]);
  const [selected, setSelected] = useState<SentEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactPicker, setShowContactPicker] = useState(false);

  // Form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<string>('individual');
  const [programmeId, setProgrammeId] = useState('');
  const [pickedContacts, setPickedContacts] = useState<Contact[]>([]);

  const isStaff = isRole('admin', 'prog_coordinator', 'internship_coordinator', 'supervisor', 'ict_support');
  const scopeLabels = isStaff ? ALL_SCOPE_LABELS : STUDENT_SCOPE_LABELS;

  useEffect(() => {
    fetchContacts();
    fetchHistory();
  }, []);

  const fetchContacts = async () => {
    setContactsLoading(true);
    try {
      const { data } = await api.get('/email/contacts');
      setContacts(data.users);
      setProgrammes(data.programmes || []);
    } catch { /* silent */ }
    finally { setContactsLoading(false); }
  };

  const fetchHistory = async () => {
    setHistLoading(true);
    try {
      const { data } = await api.get('/email/history');
      setHistory(data.emails);
    } catch { toast.error('Failed to load email history'); }
    finally { setHistLoading(false); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) { toast.error('Subject and message are required'); return; }
    if ((scope === 'individual' || scope === 'custom') && pickedContacts.length === 0) {
      toast.error('Please select at least one recipient'); return;
    }
    if (scope === 'programme' && !programmeId) { toast.error('Please select a programme'); return; }

    setLoading(true);
    try {
      const payload: any = {
        subject, body, recipientScope: scope,
        ...(scope === 'programme' && { programmeId }),
        ...((scope === 'individual' || scope === 'custom') && { recipientIds: pickedContacts.map(c => c._id) }),
      };
      const { data } = await api.post('/email/compose', payload);
      toast.success(data.message || 'Email sent successfully!');
      setSubject(''); setBody(''); setPickedContacts([]); setScope('individual');
      fetchHistory();
      setTab('history');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send email');
    } finally { setLoading(false); }
  };

  const toggleContact = (c: Contact) => {
    setPickedContacts(prev =>
      prev.find(p => p._id === c._id) ? prev.filter(p => p._id !== c._id) : [...prev, c]
    );
  };

  const filteredContacts = contacts.filter(c =>
    `${c.firstName} ${c.lastName} ${c.email} ${c.role}`.toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Email Centre</h1>
          <p className="page-subtitle">
            {isStaff
              ? 'Compose and broadcast institutional emails to students and staff'
              : 'Send emails to your supervisor and programme coordinators'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`btn ${tab === 'compose' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('compose')}>
            <Mail size={15} /> Compose
          </button>
          <button className={`btn ${tab === 'history' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setTab('history'); fetchHistory(); }}>
            <Clock size={15} /> Sent History
            {history.length > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '10px', padding: '0 6px', fontSize: '11px', marginLeft: '4px' }}>
                {history.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Student notice banner */}
      {!isStaff && tab === 'compose' && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <Info size={16} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ margin: 0, fontSize: '13px', color: '#1e40af', lineHeight: '1.5' }}>
            As a student, you can send emails to your <strong>supervisor</strong> and <strong>programme coordinators</strong>. For general support, use the <strong>Feedback Portal</strong>.
          </p>
        </div>
      )}

      {tab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: isStaff ? '1fr 320px' : '1fr', gap: '24px', alignItems: 'start' }}>
          {/* Compose form — shown to ALL users */}
          <form onSubmit={handleSend} className="card" style={{ padding: '28px' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: '16px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={18} style={{ color: 'var(--primary)' }} /> New Email
            </h2>

            {/* Recipient scope — only show options available to this role */}
            <div className="form-group">
              <label className="form-label">Send To *</label>
              {isStaff ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
                  {Object.entries(scopeLabels).map(([val, lbl]) => (
                    <label key={val} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                      border: `2px solid ${scope === val ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: scope === val ? 600 : 400,
                      background: scope === val ? 'rgba(10,92,54,0.06)' : '#fff',
                      color: scope === val ? 'var(--primary)' : 'var(--text)', transition: 'all 0.15s',
                    }}>
                      <input type="radio" name="scope" value={val} checked={scope === val}
                        onChange={() => { setScope(val); setPickedContacts([]); }} style={{ display: 'none' }} />
                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${scope === val ? 'var(--primary)' : '#d1d5db'}`, background: scope === val ? 'var(--primary)' : '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {scope === val && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', display: 'block' }} />}
                      </span>
                      {lbl}
                    </label>
                  ))}
                </div>
              ) : (
                /* Students always use individual scope — no radio needed */
                <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-3)', marginBottom: '12px' }}>
                  Sending to: <strong style={{ color: 'var(--text)' }}>Specific Person(s)</strong>
                </div>
              )}

              {/* Programme picker (staff only) */}
              {scope === 'programme' && (
                <select className="form-input" value={programmeId} onChange={e => setProgrammeId(e.target.value)} required style={{ marginBottom: '8px' }}>
                  <option value="">— Select Programme —</option>
                  {programmes.map(p => <option key={p._id} value={p._id}>{p.name} ({p.code})</option>)}
                </select>
              )}

              {/* Contact picker — shown for individual/custom (staff) or always (students) */}
              {(scope === 'individual' || scope === 'custom' || !isStaff) && (
                <div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowContactPicker(p => !p)}>
                    <Users size={14} />
                    {pickedContacts.length > 0 ? `${pickedContacts.length} selected` : 'Select recipients'}
                    <ChevronDown size={14} />
                  </button>

                  {pickedContacts.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                      {pickedContacts.map(c => (
                        <div key={c._id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: '#fff', borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}>
                          {c.firstName} {c.lastName}
                          <X size={12} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={() => toggleContact(c)} />
                        </div>
                      ))}
                    </div>
                  )}

                  {showContactPicker && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', marginTop: '8px', overflow: 'hidden', background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                      <div style={{ padding: '10px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                        <input
                          className="form-input" autoFocus
                          style={{ paddingLeft: '32px', fontSize: '13px' }}
                          placeholder="Search by name, email or role..."
                          value={contactSearch}
                          onChange={e => setContactSearch(e.target.value)}
                        />
                      </div>
                      <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                        {contactsLoading ? (
                          <div style={{ padding: '20px', textAlign: 'center' }}><div className="spinner" /></div>
                        ) : filteredContacts.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>No contacts found</div>
                        ) : filteredContacts.map(c => {
                          const isPicked = !!pickedContacts.find(p => p._id === c._id);
                          return (
                            <div key={c._id} onClick={() => toggleContact(c)}
                              style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: isPicked ? 'rgba(10,92,54,0.06)' : '', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                                {c.firstName[0]}{c.lastName[0]}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: isPicked ? 600 : 400, color: 'var(--text)' }}>{c.firstName} {c.lastName}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {ROLE_LABELS[c.role] || c.role} · {c.email}
                                </div>
                              </div>
                              {isPicked && <CheckCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowContactPicker(false)}>
                          Done ({pickedContacts.length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subject */}
            <div className="form-group">
              <label className="form-label">Subject *</label>
              <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject line" required />
            </div>

            {/* Body */}
            <div className="form-group">
              <label className="form-label">Message *</label>
              <textarea
                className="form-input"
                style={{ minHeight: '220px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={isStaff
                  ? 'Write your institutional message here...\n\nACETEL branding will be applied automatically.'
                  : 'Write your message to your supervisor or coordinator...\n\nACETEL branding will be applied automatically.'}
                required
              />
              <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: '6px 0 0' }}>
                Plain text — ACETEL IMS branding applied automatically on delivery.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setSubject(''); setBody(''); setPickedContacts([]); }}>
                Clear
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '140px' }}>
                {loading
                  ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                  : <><Send size={15} /> Send Email</>}
              </button>
            </div>
          </form>

          {/* Right sidebar — staff only */}
          {isStaff && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 700 }}>📬 Scope Guide</h3>
                {Object.entries(ALL_SCOPE_LABELS).map(([val, lbl]) => (
                  <div key={val} style={{ display: 'flex', gap: '10px', marginBottom: '10px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>·</span>
                    <div>
                      <strong>{lbl}</strong>
                      <div style={{ color: 'var(--text-3)', fontSize: '12px' }}>
                        {val === 'individual' && 'Send to one specific person'}
                        {val === 'all_students' && 'Broadcast to every active student'}
                        {val === 'all_staff' && 'All coordinators, supervisors & admin'}
                        {val === 'programme' && 'All students in a specific programme'}
                        {val === 'custom' && 'Hand-pick multiple people'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 700 }}>📊 Recent Sent</h3>
                {history.slice(0, 4).map(e => {
                  const cfg = STATUS_CONFIG[e.status] || STATUS_CONFIG.sent;
                  const Icon = cfg.icon;
                  return (
                    <div key={e._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', fontSize: '13px' }}>
                      <Icon size={14} style={{ color: cfg.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.subject}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{e.sentCount} sent · {new Date(e.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  );
                })}
                {history.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: '13px', margin: 0 }}>No emails sent yet.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', height: 'calc(100vh - 240px)' }}>
          {/* List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-3)' }}>{history.length} email{history.length !== 1 ? 's' : ''}</span>
              <button className="btn btn-ghost btn-sm" onClick={fetchHistory} disabled={histLoading}>
                <RefreshCw size={13} style={{ animation: histLoading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {histLoading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" /></div>
              ) : history.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)' }}>
                  <Clock size={28} style={{ opacity: 0.2, marginBottom: '8px' }} />
                  <p style={{ fontSize: '13px' }}>No emails sent yet</p>
                </div>
              ) : history.map(e => {
                const cfg = STATUS_CONFIG[e.status] || STATUS_CONFIG.sent;
                const Icon = cfg.icon;
                return (
                  <div key={e._id} onClick={() => setSelected(e)}
                    style={{
                      padding: '14px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                      borderLeft: selected?._id === e._id ? '3px solid var(--primary)' : '3px solid transparent',
                      background: selected?._id === e._id ? 'var(--surface-2)' : '',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <Icon size={14} style={{ color: cfg.color, flexShrink: 0, marginTop: '3px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.subject}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>
                          {e.sentCount} delivered{e.failedCount > 0 && <span style={{ color: '#dc2626' }}> · {e.failedCount} failed</span>}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
                          {new Date(e.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, background: cfg.bg, color: cfg.color, padding: '2px 8px', borderRadius: '10px', flexShrink: 0 }}>{cfg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {selected ? (
              <>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div>
                      <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700 }}>{selected.subject}</h2>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.7' }}>
                        <div>From: <strong>{selected.sender?.firstName} {selected.sender?.lastName}</strong></div>
                        <div>Sent: {new Date(selected.createdAt).toLocaleString()}</div>
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ {selected.sentCount} delivered</span>
                          {selected.failedCount > 0 && <span style={{ color: '#dc2626', marginLeft: '12px', fontWeight: 600 }}>✗ {selected.failedCount} failed</span>}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '12px', background: STATUS_CONFIG[selected.status]?.bg, color: STATUS_CONFIG[selected.status]?.color, flexShrink: 0 }}>
                      {STATUS_CONFIG[selected.status]?.label}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Message</p>
                    <div style={{ fontSize: '15px', lineHeight: '1.8', color: 'var(--text)', whiteSpace: 'pre-wrap', background: '#f9fafb', padding: '20px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      {selected.body}
                    </div>
                  </div>

                  <div style={{ padding: '20px 24px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <Users size={12} style={{ marginRight: '4px' }} /> Recipients ({selected.recipients.length})
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selected.recipients.slice(0, 40).map((r, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>
                          <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>
                            {r.name[0]}
                          </span>
                          {r.name}
                        </div>
                      ))}
                      {selected.recipients.length > 40 && (
                        <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                          +{selected.recipients.length - 40} more
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {(selected.status === 'failed' || selected.status === 'partial') && isStaff && (
                  <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: '#fff' }}>
                    <button className="btn btn-outline btn-sm" style={{ color: '#d97706', borderColor: '#d97706' }} onClick={() => {
                      setSubject(selected.subject); setBody(selected.body); setTab('compose');
                    }}>
                      <RefreshCw size={13} /> Retry / Edit & Resend
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                <Eye size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                <h3 style={{ margin: '0 0 8px', color: 'var(--text-2)' }}>Select an email</h3>
                <p style={{ fontSize: '14px' }}>Click any sent email to view its content and delivery details.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
