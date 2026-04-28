import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Send, Mail, MessageSquare, Bell, Search, X, CheckCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

type Channel = 'in-app' | 'email' | 'whatsapp';

interface Message {
  _id: string;
  from: { firstName: string; lastName: string; role: string };
  to: string;
  subject?: string;
  body: string;
  channel: Channel;
  createdAt: string;
  isRead: boolean;
}

const CHANNEL_ICONS = {
  'in-app':   { icon: Bell,           label: 'In-App',   color: '#166534' },
  'email':    { icon: Mail,           label: 'Email',    color: '#2563eb' },
  'whatsapp': { icon: MessageSquare,  label: 'WhatsApp', color: '#16a34a' },
};

export default function CommunicationPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeChannel, setActiveChannel] = useState<Channel>('in-app');
  const [showCompose, setShowCompose] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    recipientId: '', subject: '', body: '', channel: 'in-app' as Channel
  });

  const canBroadcast = ['admin', 'prog_coordinator', 'internship_coordinator'].includes(user?.role || '');

  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications?limit=100');
      setMessages(data.notifications || []);
    } catch { toast.error('Could not load messages'); }
    finally { setLoading(false); }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/users?limit=200');
      setUsers(data.users || []);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    if (canBroadcast) fetchUsers();
  }, [canBroadcast, fetchMessages, fetchUsers]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!form.body.trim()) return toast.error('Message body is required');
    setSending(true);
    try {
      await api.post('/notifications/send', form);
      toast.success('Message sent successfully');
      setShowCompose(false);
      setForm({ recipientId: '', subject: '', body: '', channel: 'in-app' });
      fetchMessages();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send message');
    } finally { setSending(false); }
  }

  async function markRead(id: string) {
    await api.put(`/notifications/${id}/read`).catch(() => {});
    setMessages(prev => prev.map(m => m._id === id ? { ...m, isRead: true } : m));
  }

  const filtered = messages.filter(m =>
    !search || m.body.toLowerCase().includes(search.toLowerCase()) ||
    m.subject?.toLowerCase().includes(search.toLowerCase())
  );

  const unread = messages.filter(m => !m.isRead).length;

  return (
    <div style={{ padding: '28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.85rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            Communication Centre
          </h1>
          <p style={{ color: '#4b5563', margin: '4px 0 0', fontSize: '0.9rem' }}>
            Manage all institutional communication channels — in-app, email and WhatsApp
          </p>
        </div>
        {canBroadcast && (
          <button onClick={() => setShowCompose(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 22px', background: '#166534', color: '#fff',
            border: 'none', borderRadius: 10, fontWeight: 700,
            fontSize: '0.9rem', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
            boxShadow: '0 2px 8px rgba(22,101,52,0.25)'
          }}>
            <Send size={16} /> Compose Message
          </button>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {(['in-app', 'email', 'whatsapp'] as Channel[]).map(ch => {
          const cfg = CHANNEL_ICONS[ch];
          const Icon = cfg.icon;
          const count = messages.filter(m => m.channel === ch).length;
          return (
            <div key={ch} onClick={() => setActiveChannel(ch)} style={{
              background: activeChannel === ch ? '#f0fdf4' : '#fff',
              border: `1.5px solid ${activeChannel === ch ? '#16a34a' : '#e5e7eb'}`,
              borderRadius: 12, padding: '18px 20px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
              transition: 'all 0.2s ease',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: activeChannel === ch ? '#dcfce7' : '#f9fafb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: cfg.color, flexShrink: 0,
              }}>
                <Icon size={22} />
              </div>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#111827' }}>{count}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#4b5563' }}>{cfg.label} Messages</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unread banner */}
      {unread > 0 && (
        <div style={{
          background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: 10,
          padding: '12px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: '0.88rem', fontWeight: 600, color: '#854d0e'
        }}>
          <Bell size={16} /> You have {unread} unread message{unread > 1 ? 's' : ''}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search messages..."
          style={{
            width: '100%', padding: '11px 14px 11px 42px',
            border: '1.5px solid #e5e7eb', borderRadius: 10,
            fontSize: '0.9rem', outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif",
            background: '#f9fafb',
          }}
        />
      </div>

      {/* Messages list */}
      <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading messages...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Bell size={40} style={{ color: '#d1d5db', margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>No messages yet</div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Messages and notifications will appear here</div>
          </div>
        ) : filtered.map((msg, i) => {
          const cfg = CHANNEL_ICONS[msg.channel] || CHANNEL_ICONS['in-app'];
          const Icon = cfg.icon;
          return (
            <div key={msg._id} onClick={() => markRead(msg._id)} style={{
              padding: '16px 20px',
              borderBottom: i < filtered.length - 1 ? '1px solid #f3f4f6' : 'none',
              background: msg.isRead ? '#fff' : '#f0fdf4',
              cursor: 'pointer', transition: 'background 0.15s',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                background: msg.isRead ? '#f3f4f6' : '#dcfce7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: cfg.color,
              }}>
                <Icon size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  {msg.subject && (
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{msg.subject}</span>
                  )}
                  {!msg.isRead && (
                    <span style={{ background: '#166534', color: '#fff', fontSize: '0.6rem', fontWeight: 800,
                      padding: '2px 7px', borderRadius: 100, textTransform: 'uppercase' }}>New</span>
                  )}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>{msg.body}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 5 }}>
                  {new Date(msg.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  {msg.isRead && <CheckCheck size={13} style={{ display: 'inline', marginLeft: 6, color: '#16a34a' }} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 560,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative' }}>
            <button onClick={() => setShowCompose(false)} style={{
              position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
              cursor: 'pointer', color: '#6b7280', padding: 4
            }}><X size={20} /></button>

            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.3rem', fontWeight: 800,
              color: '#111827', marginBottom: 6 }}>Compose Message</h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 24 }}>
              Send via in-app notification, email, or WhatsApp
            </p>

            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Channel selector */}
              <div>
                <label style={{ fontSize: '0.83rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Communication Channel
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['in-app', 'email', 'whatsapp'] as Channel[]).map(ch => {
                    const cfg = CHANNEL_ICONS[ch];
                    const Icon = cfg.icon;
                    return (
                      <button key={ch} type="button" onClick={() => setForm(f => ({ ...f, channel: ch }))}
                        style={{
                          flex: 1, padding: '10px 8px', borderRadius: 8,
                          border: `1.5px solid ${form.channel === ch ? '#166534' : '#e5e7eb'}`,
                          background: form.channel === ch ? '#f0fdf4' : '#fff',
                          color: form.channel === ch ? '#166534' : '#6b7280',
                          fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        }}>
                        <Icon size={16} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recipient */}
              <div>
                <label style={{ fontSize: '0.83rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Recipient
                </label>
                <select value={form.recipientId} onChange={e => setForm(f => ({ ...f, recipientId: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10,
                    fontSize: '0.9rem', outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif",
                    background: '#f9fafb' }}>
                  <option value="">— Broadcast to all —</option>
                  <optgroup label="Staff">
                    {users.filter(u => u.role !== 'student').map(u => (
                      <option key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.role})</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Subject (email only) */}
              {form.channel === 'email' && (
                <div>
                  <label style={{ fontSize: '0.83rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                    Subject
                  </label>
                  <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Email subject line..."
                    style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10,
                      fontSize: '0.9rem', outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif",
                      background: '#f9fafb' }} />
                </div>
              )}

              {/* Message body */}
              <div>
                <label style={{ fontSize: '0.83rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Message
                </label>
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Type your message..." rows={5} required
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10,
                    fontSize: '0.9rem', outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif",
                    background: '#f9fafb', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button type="button" onClick={() => setShowCompose(false)}
                  style={{ flex: 1, padding: '12px', border: '1.5px solid #e5e7eb', borderRadius: 10,
                    fontWeight: 600, fontSize: '0.9rem', background: '#fff', cursor: 'pointer', color: '#374151' }}>
                  Cancel
                </button>
                <button type="submit" disabled={sending}
                  style={{ flex: 2, padding: '12px', background: '#166534', color: '#fff',
                    border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: sending ? 0.7 : 1 }}>
                  <Send size={16} /> {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
