import { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, Mail, MessageSquare, ChevronDown, Search } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface Contact {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Props {
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator', supervisor: 'Academic Supervisor',
  industry_supervisor: 'Industry Supervisor',
  prog_coordinator: 'Programme Coordinator',
  internship_coordinator: 'Internship Coordinator',
  ict_support: 'ICT Support', student: 'Student',
};

type Channel = 'chat' | 'email' | 'feedback';

export default function ComposeMessage({ onClose }: Props) {
  const navigate = useNavigate();
  const [channel, setChannel] = useState<Channel>('chat');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const { data } = await api.get('/chat/contacts');
        setContacts(data.contacts || []);
      } catch { /* silent */ }
      finally { setContactsLoading(false); }
    };
    fetchContacts();
  }, []);

  useEffect(() => {
    if (showContacts) setTimeout(() => searchRef.current?.focus(), 50);
  }, [showContacts]);

  const filtered = contacts.filter(c =>
    `${c.firstName} ${c.lastName} ${c.email} ${c.role}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);

    try {
      if (channel === 'chat') {
        if (!selectedContact) { toast.error('Please select a recipient'); setLoading(false); return; }
        // Start or get existing chat then navigate
        const { data } = await api.post('/chat/start', { targetUserId: selectedContact._id });
        await api.post(`/chat/${data.chat._id}/send`, { content: message });
        toast.success(`Message sent to ${selectedContact.firstName}`);
        onClose();
        navigate('/chat');

      } else if (channel === 'email') {
        if (!selectedContact) { toast.error('Please select a recipient'); setLoading(false); return; }
        if (!subject.trim()) { toast.error('Subject is required for emails'); setLoading(false); return; }
        await api.post('/email/compose', {
          subject,
          body: message,
          recipientScope: 'individual',
          recipientIds: [selectedContact._id],
        });
        toast.success(`Email sent to ${selectedContact.firstName}`);
        onClose();

      } else if (channel === 'feedback') {
        if (!subject.trim()) { toast.error('Ticket subject is required'); setLoading(false); return; }
        await api.post('/feedback', {
          subject,
          category: 'Support',
          message,
          priority: 'Medium',
        });
        toast.success('Support ticket submitted');
        onClose();
        navigate('/feedback');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally { setLoading(false); }
  };

  const CHANNELS: { key: Channel; label: string; icon: typeof MessageCircle; color: string; desc: string }[] = [
    { key: 'chat',     label: 'Chat',     icon: MessageCircle, color: '#0a5c36', desc: 'Instant message' },
    { key: 'email',    label: 'Email',    icon: Mail,          color: '#3b82f6', desc: 'Formal email' },
    { key: 'feedback', label: 'Feedback', icon: MessageSquare, color: '#f59e0b', desc: 'Support ticket' },
  ];

  const needsRecipient = channel === 'chat' || channel === 'email';
  const needsSubject   = channel === 'email' || channel === 'feedback';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal animate-slide-up"
        style={{ maxWidth: '520px', margin: 'auto', color: 'var(--text)', background: '#fff' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ background: 'var(--primary)', borderRadius: '12px 12px 0 0' }}>
          <h2 className="modal-title" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={18} /> Compose Message
          </h2>
          <button className="btn btn-ghost" style={{ color: '#fff' }} onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSend} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--text)' }}>

          {/* Channel selector */}
          <div>
            <label className="form-label">Send via</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {CHANNELS.map(ch => (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => { setChannel(ch.key); setSelectedContact(null); setSubject(''); }}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: '10px', cursor: 'pointer',
                    border: `2px solid ${channel === ch.key ? ch.color : 'var(--border)'}`,
                    background: channel === ch.key ? ch.color + '12' : '#fff',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    transition: 'all 0.15s',
                  }}
                >
                  <ch.icon size={18} style={{ color: channel === ch.key ? ch.color : 'var(--text-3)' }} />
                  <span style={{ fontSize: '12px', fontWeight: channel === ch.key ? 700 : 400, color: channel === ch.key ? ch.color : 'var(--text-3)' }}>
                    {ch.label}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{ch.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recipient picker */}
          {needsRecipient && (
            <div style={{ position: 'relative' }}>
              <label className="form-label">To *</label>
              <button
                type="button"
                className="form-input"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => setShowContacts(p => !p)}
              >
                {selectedContact ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                      {selectedContact.firstName[0]}{selectedContact.lastName[0]}
                    </div>
                    <span style={{ fontWeight: 600 }}>{selectedContact.firstName} {selectedContact.lastName}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>({ROLE_LABELS[selectedContact.role] || selectedContact.role})</span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-3)' }}>Select recipient…</span>
                )}
                <ChevronDown size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              </button>

              {showContacts && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#fff', border: '1px solid var(--border)', borderRadius: '10px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)', marginTop: '4px', overflow: 'hidden',
                }}>
                  <div style={{ padding: '8px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                    <input
                      ref={searchRef}
                      className="form-input"
                      style={{ paddingLeft: '30px', fontSize: '13px' }}
                      placeholder="Search contacts…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {contactsLoading ? (
                      <div style={{ padding: '20px', textAlign: 'center' }}><div className="spinner" /></div>
                    ) : filtered.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>No contacts found</div>
                    ) : filtered.map(c => (
                      <div
                        key={c._id}
                        onClick={() => { setSelectedContact(c); setShowContacts(false); setSearch(''); }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                          borderBottom: '1px solid var(--border)', transition: 'background 0.1s',
                          background: selectedContact?._id === c._id ? 'rgba(10,92,54,0.06)' : '',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = selectedContact?._id === c._id ? 'rgba(10,92,54,0.06)' : '')}
                      >
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.firstName} {c.lastName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ROLE_LABELS[c.role] || c.role} · {c.email}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subject */}
          {needsSubject && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Subject *</label>
              <input
                className="form-input"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder={channel === 'feedback' ? 'Briefly describe your issue…' : 'Email subject…'}
                required
              />
            </div>
          )}

          {/* Message body */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Message *</label>
            <textarea
              className="form-input"
              style={{ minHeight: '120px', resize: 'vertical', lineHeight: '1.6' }}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                channel === 'chat'     ? 'Type your message…' :
                channel === 'email'    ? 'Write your email…\n\nACETEL branding applied automatically.' :
                                        'Describe your issue in detail…'
              }
              required
            />
          </div>

          {/* Channel-specific note */}
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.5' }}>
            {channel === 'chat'     && '💬 Message delivered instantly. Recipient gets a notification and email if offline.'}
            {channel === 'email'    && '📧 Sent with ACETEL IMS branding. Delivered to recipient\'s inbox.'}
            {channel === 'feedback' && '🎫 Creates a support ticket visible to coordinators and admins.'}
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '120px' }}>
              {loading ? 'Sending…' : <><Send size={14} /> Send</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
