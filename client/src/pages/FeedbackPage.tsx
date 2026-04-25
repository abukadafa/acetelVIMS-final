import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { MessageSquare, Send, CheckCircle, Download, Star, Flag, Clock, Filter, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FeedbackEntry {
  _id: string; subject: string; category: string; message: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'Assigned' | 'Closed';
  satisfactionRating?: number;
  user: { firstName: string; lastName: string; role: string; email: string; };
  assignedTo?: { firstName: string; lastName: string; role: string; };
  responses: Array<{ user: { firstName: string; lastName: string; role: string; }; message: string; createdAt: string; }>;
  createdAt: string; updatedAt: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  Low: '#6b7280', Medium: '#f59e0b', High: '#f97316', Urgent: '#ef4444',
};
const PRIORITY_ICON: Record<string, any> = {
  Low: Clock, Medium: Flag, High: AlertTriangle, Urgent: AlertTriangle,
};

export default function FeedbackPage() {
  const { isRole, user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [selected, setSelected] = useState<FeedbackEntry | null>(null);
  const [stats, setStats] = useState({ open: 0, assigned: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [search, setSearch] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('Support');
  const [newMessage, setNewMessage] = useState('');
  const [newPriority, setNewPriority] = useState('Medium');
  const [reply, setReply] = useState('');
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchFeedback(); }, [filterStatus, filterPriority]);

  const fetchFeedback = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      const { data } = await api.get(`/feedback?${params.toString()}`);
      setFeedbackList(data.feedback);
      setStats(data.stats || { open: 0, assigned: 0, closed: 0 });
      if (selected) {
        const updated = data.feedback.find((f: any) => f._id === selected._id);
        if (updated) setSelected(updated);
      }
    } catch { toast.error('Failed to load feedback'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/feedback', { subject: newSubject, category: newCategory, message: newMessage, priority: newPriority });
      setNewSubject(''); setNewMessage(''); setShowNew(false);
      toast.success('Ticket submitted successfully');
      fetchFeedback();
    } catch { toast.error('Failed to submit ticket'); }
    finally { setSubmitting(false); }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/feedback/${selected._id}/respond`, { message: reply });
      setReply('');
      toast.success('Response sent');
      fetchFeedback();
    } catch { toast.error('Failed to send response'); }
    finally { setSubmitting(false); }
  };

  const handleClose = async () => {
    if (!selected) return;
    try {
      await api.put(`/feedback/${selected._id}/status`, { status: 'Closed' });
      toast.success('Ticket marked as resolved');
      fetchFeedback();
    } catch { toast.error('Permission denied or server error'); }
  };

  const handleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !rating) return;
    try {
      await api.post(`/feedback/${selected._id}/rate`, { rating, comment: ratingComment });
      toast.success('Thank you for your feedback!');
      setRating(0); setRatingComment('');
      fetchFeedback();
    } catch { toast.error('Failed to submit rating'); }
  };

  const filtered = feedbackList.filter(f => {
    if (!search) return true;
    return `${f.subject} ${f.category} ${f.message} ${f.user.firstName} ${f.user.lastName}`.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Feedback Portal</h1>
          <p className="page-subtitle">Institutional support & communication channel</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isRole('admin', 'prog_coordinator', 'internship_coordinator', 'ict_support') && (
            <button className="btn btn-outline" onClick={() => window.open(`${api.defaults.baseURL}feedback/export`, '_blank')}>
              <Download size={16} /> Export CSV
            </button>
          )}
          {isRole('student') && (
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              <MessageSquare size={16} /> New Ticket
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      {!isRole('student') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Open', count: stats.open, color: '#0a5c36' },
            { label: 'In Progress', count: stats.assigned, color: '#3b82f6' },
            { label: 'Resolved', count: stats.closed, color: '#6b7280' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
              <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{s.label}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '20px', color: s.color }}>{s.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input className="form-input" style={{ paddingLeft: '32px' }} placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="Open">Open</option>
          <option value="Assigned">In Progress</option>
          <option value="Closed">Resolved</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">All Priority</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => { setFilterStatus(''); setFilterPriority(''); setSearch(''); }}>
          <Filter size={14} /> Clear
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', height: 'calc(100vh - 320px)' }}>
        {/* List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '13px', color: 'var(--text-3)' }}>
            {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)' }}>
                <MessageSquare size={28} style={{ opacity: 0.2, marginBottom: '8px' }} />
                <p style={{ fontSize: '13px' }}>No tickets found</p>
              </div>
            ) : filtered.map(f => {
              const PIcon = PRIORITY_ICON[f.priority] || Flag;
              return (
                <div key={f._id}
                  onClick={() => setSelected(f)}
                  style={{
                    padding: '14px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    borderLeft: selected?._id === f._id ? '3px solid var(--primary)' : '3px solid transparent',
                    background: selected?._id === f._id ? 'var(--surface-2)' : '',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)', flex: 1, marginRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.subject}</span>
                    <PIcon size={12} style={{ color: PRIORITY_COLOR[f.priority], flexShrink: 0, marginTop: '2px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', background: f.status === 'Open' ? '#dcfce7' : f.status === 'Assigned' ? '#dbeafe' : '#f3f4f6', color: f.status === 'Open' ? '#16a34a' : f.status === 'Assigned' ? '#2563eb' : '#6b7280', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>{f.status === 'Assigned' ? 'In Progress' : f.status}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{f.category}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)', marginLeft: 'auto' }}>{new Date(f.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {!isRole('student') && (
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{f.user.firstName} {f.user.lastName} · {f.responses.length} repl{f.responses.length === 1 ? 'y' : 'ies'}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '17px', color: 'var(--text)' }}>{selected.subject}</span>
                    <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '12px', fontWeight: 700, background: PRIORITY_COLOR[selected.priority] + '22', color: PRIORITY_COLOR[selected.priority] }}>{selected.priority}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                    {selected.category} · {selected.user.firstName} {selected.user.lastName} · {new Date(selected.createdAt).toLocaleString()}
                    {selected.assignedTo && <span> · Assigned to <strong>{selected.assignedTo.firstName} {selected.assignedTo.lastName}</strong></span>}
                  </div>
                </div>
                {isRole('admin', 'prog_coordinator', 'internship_coordinator', 'supervisor') && selected.status !== 'Closed' && (
                  <button className="btn btn-sm btn-outline" style={{ color: '#16a34a', borderColor: '#16a34a' }} onClick={handleClose}>
                    <CheckCircle size={14} /> Resolve
                  </button>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f9fafb' }}>
                {/* Original message */}
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: 'var(--text-3)' }}>
                    <strong style={{ color: 'var(--text)' }}>{selected.user.firstName} {selected.user.lastName} <span style={{ fontWeight: 400 }}>({selected.user.role})</span></strong>
                    <span>{new Date(selected.createdAt).toLocaleString()}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{selected.message}</p>
                </div>

                {/* Responses */}
                {selected.responses.map((r, i) => {
                  const isStaff = r.user.role !== 'student';
                  return (
                    <div key={i} style={{ background: isStaff ? 'var(--primary)' : '#fff', border: isStaff ? 'none' : '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', alignSelf: isStaff ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: isStaff ? 'rgba(255,255,255,0.7)' : 'var(--text-3)', gap: '20px' }}>
                        <strong style={{ color: isStaff ? '#fff' : 'var(--text)' }}>{r.user.firstName} {r.user.lastName} <span style={{ fontWeight: 400 }}>({r.user.role})</span></strong>
                        <span>{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: isStaff ? '#fff' : 'var(--text)', whiteSpace: 'pre-wrap' }}>{r.message}</p>
                    </div>
                  );
                })}

                {/* Rating for closed tickets (student only) */}
                {selected.status === 'Closed' && isRole('student') && !selected.satisfactionRating && (
                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                    <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '14px' }}>How would you rate this support experience?</p>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} size={24} style={{ cursor: 'pointer', color: n <= rating ? '#f59e0b' : '#d1d5db', fill: n <= rating ? '#f59e0b' : 'none', transition: 'color 0.15s' }} onClick={() => setRating(n)} />
                      ))}
                    </div>
                    {rating > 0 && (
                      <form onSubmit={handleRate}>
                        <textarea className="form-input" style={{ width: '100%', minHeight: '60px', resize: 'none', marginBottom: '8px', fontSize: '13px' }} placeholder="Optional comment..." value={ratingComment} onChange={e => setRatingComment(e.target.value)} />
                        <button type="submit" className="btn btn-primary btn-sm">Submit Rating</button>
                      </form>
                    )}
                  </div>
                )}
                {selected.satisfactionRating && (
                  <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-3)' }}>
                    Rated {selected.satisfactionRating}/5 ⭐ by student
                  </div>
                )}
              </div>

              {selected.status !== 'Closed' ? (
                <form onSubmit={handleReply} style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: '#fff', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                  <textarea
                    className="form-input"
                    style={{ flex: 1, resize: 'none', minHeight: '60px', fontSize: '14px' }}
                    placeholder="Type your reply..."
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-primary" disabled={submitting || !reply.trim()} style={{ height: '44px', padding: '0 20px' }}>
                    <Send size={16} /> Send
                  </button>
                </form>
              ) : (
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#16a34a', fontWeight: 600, fontSize: '14px' }}>
                  <CheckCircle size={16} /> This ticket has been resolved
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
              <MessageSquare size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 8px', color: 'var(--text-2)' }}>Select a ticket</h3>
              <p style={{ fontSize: '14px' }}>Click any ticket from the list to view the full conversation.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNew && (
        <div className="modal-overlay">
          <div className="modal-card animate-slide-up" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Submit Support Ticket</h2>
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div className="form-group">
                <label className="form-label">Subject *</label>
                <input className="form-input" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Brief summary of your issue" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-input" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                    <option value="Support">General Support</option>
                    <option value="Placement">Placement Issue</option>
                    <option value="Logbook">Logbook Question</option>
                    <option value="Technical">Technical Problem</option>
                    <option value="Academic">Academic Support</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority *</label>
                  <select className="form-input" value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Message *</label>
                <textarea className="form-input" style={{ minHeight: '130px' }} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Describe your issue in detail..." required />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
