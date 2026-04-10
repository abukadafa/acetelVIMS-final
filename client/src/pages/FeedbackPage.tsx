import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { MessageSquare, Send, CheckCircle, Download } from 'lucide-react';

interface FeedbackEntry {
  _id: string;
  subject: string;
  category: string;
  message: string;
  status: 'Open' | 'Assigned' | 'Closed';
  user: { firstName: string; lastName: string; role: string; email: string };
  responses: Array<{
    user: { firstName: string; lastName: string; role: string };
    message: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function FeedbackPage() {
  const { isRole } = useAuth();
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [selected, setSelected] = useState<FeedbackEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  
  // New Feedback Form
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newMessage, setNewMessage] = useState('');
  
  // Response Form
  const [reply, setReply] = useState('');

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    try {
      const { data } = await api.get('/feedback');
      setFeedbackList(data.feedback);
      if (selected) {
        const updated = data.feedback.find((f: any) => f._id === selected._id);
        if (updated) setSelected(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/feedback', { subject: newSubject, category: newCategory, message: newMessage });
      setNewSubject(''); setNewMessage(''); setShowNew(false);
      fetchFeedback();
    } catch (err) { alert('Failed to submit feedback'); }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    try {
      await api.post(`/feedback/${selected._id}/respond`, { message: reply });
      setReply('');
      fetchFeedback();
    } catch (err) { alert('Failed to send response'); }
  };

  const handleClose = async () => {
    if (!selected) return;
    try {
      await api.put(`/feedback/${selected._id}/status`, { status: 'Closed' });
      fetchFeedback();
    } catch (err) { alert('Permission denied or server error'); }
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Institutional Feedback Portal</h1>
          <p className="page-subtitle">Bi-directional communication channel for students and academic staff</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {(isRole('admin') || isRole('prog_coordinator', 'internship_coordinator', 'ict_support')) && (
            <button 
              className="btn btn-outline" 
              onClick={() => window.open(`${api.defaults.baseURL}/feedback/export`, '_blank')}
            >
              <Download size={18} /> Export Log
            </button>
          )}
          {isRole('student') && (
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              <MessageSquare size={18} /> New Ticket
            </button>
          )}
        </div>
      </div>

      <div className="grid-sidebar-layout">
        {/* ── Sidebar: Feedback List ── */}
        <div className="card list-panel">
          <div className="card-header">
             <h3 className="card-title">All Conversations</h3>
          </div>
          <div className="scroll-area">
            {feedbackList.length === 0 ? (
              <div className="empty-state">No feedback found</div>
            ) : (
              feedbackList.map(f => (
                <div 
                  key={f._id} 
                  className={`list-item ${selected?._id === f._id ? 'active' : ''}`}
                  onClick={() => setSelected(f)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="subject">{f.subject}</span>
                    <span className={`status-dot ${f.status.toLowerCase()}`}></span>
                  </div>
                  <div className="meta">
                    {f.category} • {new Date(f.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Main Detail View ── */}
        <div className="card content-panel">
          {selected ? (
            <div className="feedback-detail">
              <div className="detail-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className={`badge badge-${selected.status === 'Closed' ? 'gray' : 'green'}`}>{selected.status}</span>
                    <h2 style={{ margin: 0 }}>{selected.subject}</h2>
                  </div>
                  <p style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>
                    Category: {selected.category} | Started on {new Date(selected.createdAt).toLocaleString()}
                  </p>
                </div>
                {!isRole('student') && selected.status !== 'Closed' && (
                   <button className="btn btn-sm btn-outline btn-danger" onClick={handleClose}>
                     <CheckCircle size={16} /> Mark as Resolved
                   </button>
                )}
              </div>

              <div className="conversation-thread">
                {/* Original Message */}
                <div className="message-bubble student">
                   <div className="msg-header">
                     <strong>{selected.user.firstName} {selected.user.lastName}</strong>
                     <span>{new Date(selected.createdAt).toLocaleString()}</span>
                   </div>
                   <div className="msg-body">{selected.message}</div>
                </div>

                {/* Responses */}
                {selected.responses.map((r, i) => (
                  <div key={i} className={`message-bubble ${r.user.role === 'student' ? 'student' : 'staff'}`}>
                     <div className="msg-header">
                       <strong>{r.user.firstName} {r.user.lastName} <span className="role-tag">({r.user.role})</span></strong>
                       <span>{new Date(r.createdAt).toLocaleString()}</span>
                     </div>
                     <div className="msg-body">{r.message}</div>
                  </div>
                ))}
              </div>

              {selected.status !== 'Closed' ? (
                <form className="reply-form" onSubmit={handleReply}>
                  <textarea 
                    placeholder="Type your response here..." 
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    required
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button type="submit" className="btn btn-primary">
                      <Send size={18} /> Send Reply
                    </button>
                  </div>
                </form>
              ) : (
                <div className="resolved-banner">
                  <CheckCircle size={20} /> This conversation has been resolved.
                </div>
              )}
            </div>
          ) : (
            <div className="empty-selection">
              <MessageSquare size={48} className="icon" />
              <h3>Select a conversation to view details</h3>
              <p>Institutional oversight ensures all student queries are addressed by relevant staff.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── New Feedback Modal (Students Only) ── */}
      {showNew && (
        <div className="modal-overlay">
          <div className="modal-card animate-slide-up" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Submit Support Ticket</h2>
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input 
                  className="form-input" 
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  placeholder="Summarize your issue"
                  required 
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select 
                    className="form-input" 
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                  >
                    <option value="General">General Inquiry</option>
                    <option value="Placement">Placement Issue</option>
                    <option value="Logbook">Logbook Question</option>
                    <option value="Technical">Technical Problem</option>
                    <option value="Academic">Academic Support</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea 
                  className="form-input" 
                  style={{ minHeight: '150px' }}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Provide details about your query..."
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .grid-sidebar-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 24px;
          height: calc(100vh - 220px);
        }
        .list-panel { display: flex; flexDirection: column; overflow: hidden; padding: 0 !important; }
        .scroll-area { flex: 1; overflow-y: auto; }
        .list-item { 
          padding: 16px 20px; 
          border-bottom: 1px solid var(--border); 
          cursor: pointer; 
          transition: all 0.2s;
        }
        .list-item:hover { background: var(--surface-2); }
        .list-item.active { background: var(--surface-2); border-left: 4px solid var(--primary); }
        .list-item .subject { font-weight: 600; font-size: 0.95rem; color: var(--text); }
        .list-item .meta { font-size: 0.75rem; color: var(--text-3); margin-top: 4px; }
        
        .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .status-dot.open { background: var(--primary); box-shadow: 0 0 8px var(--primary); }
        .status-dot.assigned { background: var(--blue); }
        .status-dot.closed { background: var(--gray); }

        .content-panel { padding: 0 !important; overflow: hidden; display: flex; flex-direction: column; }
        .feedback-detail { display: flex; flex-direction: column; height: 100%; }
        .detail-header { padding: 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-start; }
        .conversation-thread { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; background: #f9fafb; }
        
        .message-bubble { max-width: 85%; padding: 16px; border-radius: 12px; position: relative; }
        .message-bubble.student { align-self: flex-start; background: white; border: 1px solid var(--border); }
        .message-bubble.staff { align-self: flex-end; background: var(--primary); color: white; }
        .msg-header { display: flex; justify-content: space-between; gap: 24px; font-size: 0.75rem; margin-bottom: 8px; opacity: 0.8; }
        .msg-body { font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; }
        .role-tag { font-size: 0.65rem; text-transform: uppercase; font-weight: 800; }

        .reply-form { padding: 24px; border-top: 1px solid var(--border); background: white; }
        .reply-form textarea { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 12px; min-height: 100px; font-family: inherit; resize: none; transition: border-color 0.2s; }
        .reply-form textarea:focus { border-color: var(--primary); outline: none; }

        .resolved-banner { padding: 24px; text-align: center; color: var(--text-3); background: #f3f4f6; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 600; }

        .empty-selection { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; color: var(--text-3); text-align: center; }
        .empty-selection .icon { opacity: 0.1; margin-bottom: 24px; }
      `}</style>
    </div>
  );
}
