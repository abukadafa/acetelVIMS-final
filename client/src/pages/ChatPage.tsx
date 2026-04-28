import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { socket, connectSocket, onNewMessage } from '../lib/socket';
import { Send, Search, MessageSquare, ArrowLeft, Circle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ChatPage() {
  const { user } = useAuth();
  const [rooms, setRooms]       = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [active, setActive]     = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput]       = useState('');
  const [search, setSearch]     = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<'rooms' | 'contacts'>('rooms');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      connectSocket(user.id);
      fetchRooms();
      fetchContacts();
      onNewMessage(msg => {
        setMessages(prev => [...prev, msg]);
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
    return () => { socket.off('new_message'); };
  }, [user]);

  useEffect(() => {
    if (active) fetchMessages(active._id);
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/chat');
      setRooms(data.rooms || []);
    } catch {
      return;
    } finally { setLoading(false); }
  };

  const fetchContacts = async () => {
    try {
      const { data } = await api.get('/chat/contacts');
      setContacts(data.contacts || []);
    } catch {
      return;
    }
  };

  const fetchMessages = async (roomId: string) => {
    try {
      const { data } = await api.get(`/chat/${roomId}`);
      setMessages(data.messages || []);
    } catch { toast.error('Failed to load messages'); }
  };

  const startChat = async (contact: any) => {
    try {
      const { data } = await api.post('/chat/start', { participantId: contact._id });
      setActive(data.room);
      setView('rooms');
      fetchRooms();
    } catch { toast.error('Failed to start chat'); }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !active) return;
    setSending(true);
    try {
      const { data } = await api.post(`/chat/${active._id}`, { content: input.trim() });
      setMessages(prev => [...prev, data.data]);
      setInput('');
      socket.emit('send_message', { roomId: active._id, message: data.data });
    } catch { toast.error('Failed to send message'); }
    finally { setSending(false); }
  };

  const getOtherParticipant = (room: any) => {
    const parts = room.participants || [];
    return parts.find((p: any) => (p._id || p) !== user?.id) || parts[0];
  };

  const filteredContacts = contacts.filter(c =>
    !search || `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor: Record<string, string> = {
    student: '#166534', supervisor: '#2563eb', industry_supervisor: '#7c3aed',
    admin: '#dc2626', prog_coordinator: '#d97706', internship_coordinator: '#0891b2',
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 86px)', background: '#f9fafb', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 320, borderRight: '1.5px solid #e5e7eb', background: '#fff',
        display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '20px 18px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.2rem', fontWeight: 800,
            color: '#111827', margin: '0 0 12px' }}>Real-Time Chat</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['rooms', 'contacts'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                flex: 1, padding: '8px', border: `1.5px solid ${view === v ? '#166534' : '#e5e7eb'}`,
                borderRadius: 8, background: view === v ? '#f0fdf4' : '#fff',
                color: view === v ? '#166534' : '#6b7280',
                fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              }}>
                {v === 'rooms' ? '💬 Chats' : '👥 Contacts'}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={view === 'rooms' ? 'Search chats...' : 'Search contacts...'}
              style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1.5px solid #e5e7eb',
                borderRadius: 8, fontSize: '0.85rem', outline: 'none', background: '#f9fafb',
                fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading...</div>
          ) : view === 'rooms' ? (
            rooms.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                <MessageSquare size={32} style={{ margin: '0 auto 10px', color: '#d1d5db' }} />
                <div style={{ fontWeight: 700, marginBottom: 4 }}>No chats yet</div>
                <div style={{ fontSize: '0.82rem' }}>Go to Contacts to start a conversation</div>
              </div>
            ) : rooms.map(room => {
              const other = getOtherParticipant(room);
              const isActive = active?._id === room._id;
              return (
                <div key={room._id} onClick={() => setActive(room)} style={{
                  padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  background: isActive ? '#f0fdf4' : 'transparent',
                  borderLeft: isActive ? '3px solid #166534' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: '#166534', color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
                    fontFamily: "'Syne', sans-serif" }}>
                    {other?.firstName?.[0]}{other?.lastName?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>
                      {other?.firstName} {other?.lastName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {room.lastMessage?.content || 'No messages yet'}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            filteredContacts.map(contact => (
              <div key={contact._id} onClick={() => startChat(contact)} style={{
                padding: '14px 18px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 12, transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: roleColor[contact.role] || '#166534',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.85rem', fontFamily: "'Syne', sans-serif" }}>
                  {contact.firstName?.[0]}{contact.lastName?.[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>
                    {contact.firstName} {contact.lastName}
                  </div>
                  <div style={{ fontSize: '0.73rem', color: roleColor[contact.role] || '#6b7280',
                    fontWeight: 600, textTransform: 'capitalize' }}>
                    {contact.role?.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Chat area ── */}
      {active ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Chat header */}
          <div style={{ padding: '14px 22px', borderBottom: '1.5px solid #e5e7eb',
            background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setActive(null)} style={{ background: 'none', border: 'none',
              cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={18} />
            </button>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#166534',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '0.82rem', flexShrink: 0 }}>
              {getOtherParticipant(active)?.firstName?.[0]}
              {getOtherParticipant(active)?.lastName?.[0]}
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#111827', fontFamily: "'Syne', sans-serif" }}>
                {getOtherParticipant(active)?.firstName} {getOtherParticipant(active)?.lastName}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4 }}>
                <Circle size={7} fill="#16a34a" /> Online
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px',
            display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: '#9ca3af' }}>
                <MessageSquare size={40} style={{ margin: '0 auto 10px' }} />
                <div>No messages yet — say hello!</div>
              </div>
            ) : messages.map((msg: any, i) => {
              const isMine = (msg.sender?._id || msg.sender) === user?.id;
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '70%', padding: '10px 14px', borderRadius: isMine ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    background: isMine ? '#166534' : '#fff',
                    color: isMine ? '#fff' : '#111827',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    border: isMine ? 'none' : '1px solid #e5e7eb',
                    fontSize: '0.9rem', lineHeight: 1.5,
                  }}>
                    {msg.content}
                    <div style={{ fontSize: '0.65rem', marginTop: 4, opacity: 0.65, textAlign: 'right' }}>
                      {new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} style={{ padding: '14px 22px',
            borderTop: '1.5px solid #e5e7eb', background: '#fff',
            display: 'flex', gap: 10, alignItems: 'center' }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '12px 16px', border: '1.5px solid #e5e7eb',
                borderRadius: 10, fontSize: '0.9rem', outline: 'none', background: '#f9fafb',
                fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
            <button type="submit" disabled={sending || !input.trim()} style={{
              width: 44, height: 44, borderRadius: 10, background: '#166534',
              color: '#fff', border: 'none', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              opacity: sending || !input.trim() ? 0.6 : 1,
            }}>
              <Send size={18} />
            </button>
          </form>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12, color: '#9ca3af' }}>
          <MessageSquare size={56} style={{ color: '#d1d5db' }} />
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: '1.2rem', color: '#374151' }}>Select a conversation</div>
          <div style={{ fontSize: '0.875rem' }}>Choose a chat or start a new one from Contacts</div>
        </div>
      )}
    </div>
  );
}
