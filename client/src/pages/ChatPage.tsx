import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { socket } from '../lib/socket';
import { Send, Search, MessageCircle, UserCircle, Trash2, ChevronLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Contact { _id: string; firstName: string; lastName: string; role: string; email: string; avatar?: string; }
interface Message { _id: string; sender: { _id: string; firstName: string; lastName: string; role: string }; content: string; type: string; createdAt: string; readBy: string[]; }
interface Chat { _id: string; participants: Contact[]; lastMessage?: string; lastMessageAt?: string; }

export default function ChatPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<'chats' | 'contacts'>('chats');
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  const loadChats = useCallback(async () => {
    try {
      const { data } = await api.get('/chat');
      setChats(data.chats);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [chatRes, contactRes] = await Promise.all([api.get('/chat'), api.get('/chat/contacts')]);
        setChats(chatRes.data.chats);
        setContacts(contactRes.data.contacts);
      } catch { toast.error('Failed to load chat'); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    const handler = (data: any) => {
      if (activeChat && data.chatId === activeChat._id) {
        setMessages(prev => [...prev, data.message]);
        scrollToBottom();
      }
      loadChats();
    };
    socket.on('chat:new_message', handler);
    return () => { socket.off('chat:new_message', handler); };
  }, [activeChat, loadChats]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const openChat = async (chat: Chat) => {
    setActiveChat(chat);
    setMobileShowChat(true);
    try {
      const { data } = await api.get(`/chat/${chat._id}/messages`);
      setMessages(data.messages);
    } catch { toast.error('Failed to load messages'); }
  };

  const startNewChat = async (contact: Contact) => {
    try {
      const { data } = await api.post('/chat/start', { targetUserId: contact._id });
      await loadChats();
      openChat(data.chat);
      setView('chats');
    } catch { toast.error('Could not start chat'); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !newMsg.trim() || sending) return;
    setSending(true);
    const optimistic: Message = {
      _id: `tmp-${Date.now()}`,
      sender: { _id: user!.id, firstName: user!.firstName, lastName: user!.lastName, role: user!.role },
      content: newMsg.trim(), type: 'text', createdAt: new Date().toISOString(), readBy: [user!.id],
    };
    setMessages(prev => [...prev, optimistic]);
    const msgText = newMsg.trim();
    setNewMsg('');
    try {
      await api.post(`/chat/${activeChat._id}/send`, { content: msgText });
      await loadChats();
    } catch { toast.error('Failed to send message'); setMessages(prev => prev.filter(m => m._id !== optimistic._id)); }
    finally { setSending(false); }
  };

  const deleteMessage = async (msgId: string) => {
    if (!activeChat) return;
    try {
      await api.delete(`/chat/${activeChat._id}/messages/${msgId}`);
      setMessages(prev => prev.filter(m => m._id !== msgId));
    } catch { toast.error('Cannot delete message'); }
  };

  const otherParticipant = (chat: Chat): Contact | undefined =>
    chat.participants?.find(p => p._id !== user?.id);

  const filteredContacts = contacts.filter(c =>
    `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredChats = chats.filter(c => {
    const other = otherParticipant(c);
    return !search || `${other?.firstName} ${other?.lastName}`.toLowerCase().includes(search.toLowerCase());
  });

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator', supervisor: 'Supervisor',
    prog_coordinator: 'Programme Coordinator', internship_coordinator: 'Internship Coordinator',
    ict_support: 'ICT Support', student: 'Student',
  };

  if (loading) return <div className="page-loader"><div className="spinner spinner-lg"></div></div>;

  return (
    <div className="page-container animate-fade" style={{ padding: 0, height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: '100%', overflow: 'hidden' }} className="chat-layout">

        {/* ── LEFT PANEL ── */}
        <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden' }}
          className={mobileShowChat ? 'chat-panel-hidden' : ''}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button onClick={() => setView('chats')} className={`btn btn-sm ${view === 'chats' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}>
                <MessageCircle size={14} /> Chats
              </button>
              <button onClick={() => setView('contacts')} className={`btn btn-sm ${view === 'contacts' ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1 }}>
                <UserCircle size={14} /> Contacts
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: '32px', fontSize: '13px' }}
                placeholder={view === 'chats' ? 'Search conversations...' : 'Search contacts...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {view === 'chats' ? (
              filteredChats.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)' }}>
                  <MessageCircle size={32} style={{ opacity: 0.2, marginBottom: '8px' }} />
                  <p style={{ fontSize: '13px' }}>No conversations yet.<br />Go to Contacts to start one.</p>
                </div>
              ) : filteredChats.map(chat => {
                const other = otherParticipant(chat);
                const isActive = activeChat?._id === chat._id;
                return (
                  <div key={chat._id} onClick={() => openChat(chat)}
                    style={{ padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: isActive ? 'var(--surface-2)' : '', borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                        {other?.firstName?.[0]}{other?.lastName?.[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{other?.firstName} {other?.lastName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {chat.lastMessage || 'No messages yet'}
                        </div>
                      </div>
                      {chat.lastMessageAt && (
                        <div style={{ fontSize: '10px', color: 'var(--text-3)', flexShrink: 0 }}>
                          {new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              filteredContacts.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>No contacts found</div>
              ) : filteredContacts.map(contact => (
                <div key={contact._id} onClick={() => startNewChat(contact)}
                  style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{contact.firstName} {contact.lastName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{ROLE_LABELS[contact.role] || contact.role}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: Chat window ── */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f9fafb' }}
          className={!mobileShowChat ? 'chat-panel-hidden' : ''}>
          {activeChat ? (
            <>
              {/* Header */}
              <div style={{ padding: '14px 20px', background: '#fff', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="btn btn-ghost btn-sm chat-back-btn" onClick={() => setMobileShowChat(false)}>
                  <ChevronLeft size={18} />
                </button>
                {(() => { const other = otherParticipant(activeChat); return (
                  <>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>
                      {other?.firstName?.[0]}{other?.lastName?.[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>{other?.firstName} {other?.lastName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{ROLE_LABELS[other?.role || ''] || other?.role}</div>
                    </div>
                  </>
                ); })()}
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: '40px', fontSize: '14px' }}>
                    <MessageCircle size={32} style={{ opacity: 0.15, marginBottom: '8px' }} />
                    <p>Start the conversation!</p>
                  </div>
                )}
                {messages.map(msg => {
                  const isMine = msg.sender._id === user?.id;
                  return (
                    <div key={msg._id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: '8px' }}>
                      {!isMine && (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0, alignSelf: 'flex-end' }}>
                          {msg.sender.firstName?.[0]}{msg.sender.lastName?.[0]}
                        </div>
                      )}
                      <div style={{ maxWidth: '70%', position: 'relative' }}>
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: isMine ? 'var(--primary)' : '#fff',
                          color: isMine ? '#fff' : 'var(--text)',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                          fontSize: '14px', lineHeight: '1.5',
                          wordBreak: 'break-word',
                        }}>
                          {msg.content}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', textAlign: isMine ? 'right' : 'left', display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'center', gap: '6px' }}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isMine && (
                            <button onClick={() => deleteMessage(msg._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, opacity: 0.5 }} title="Delete">
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} style={{ padding: '16px 20px', background: '#fff', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <textarea
                  className="form-input"
                  style={{ flex: 1, resize: 'none', minHeight: '44px', maxHeight: '120px', fontSize: '14px', overflowY: 'auto' }}
                  placeholder="Type a message..."
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
                  rows={1}
                />
                <button type="submit" className="btn btn-primary" disabled={!newMsg.trim() || sending}
                  style={{ height: '44px', width: '44px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', flexShrink: 0 }}>
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
              <MessageCircle size={56} style={{ opacity: 0.1, marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 8px', color: 'var(--text-2)' }}>Select a conversation</h3>
              <p style={{ fontSize: '14px', textAlign: 'center' }}>Choose from your chats or start a new conversation via Contacts</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .chat-layout { position: relative; }
        @media (max-width: 768px) {
          .chat-layout { grid-template-columns: 1fr !important; }
          .chat-panel-hidden { display: none !important; }
          .chat-back-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .chat-back-btn { display: none !important; }
          .chat-panel-hidden { display: flex !important; }
        }
        .form-input:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 3px rgba(10,92,54,0.1); }
      `}</style>
    </div>
  );
}
