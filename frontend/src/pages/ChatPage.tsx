import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, RefreshCw, Send, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventoryBasePath } from '../lib/useInventoryBasePath';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';

interface GroupMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  body: string;
  created_at: string;
  from_me: boolean;
}

const POLL_INTERVAL_MS = 5000;

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { basePath } = useInventoryBasePath();

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const userName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get<GroupMessage[]>('/messages/group');
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (!silent) {
        void notifyError(getErrorMessage(err, 'Unable to load messages.'), 'Load Failed');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadMessages(true);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (newMessage.trim() === '' || sending) return;

    const body = newMessage.trim();
    setSending(true);
    setNewMessage('');

    try {
      await api.post('/messages/group', { body });
      void loadMessages(true);
      inputRef.current?.focus();
    } catch (err) {
      setNewMessage(body);
      void notifyError(getErrorMessage(err, 'Unable to send message.'), 'Send Failed');
    } finally {
      setSending(false);
    }
  };

  const onMenuBack = (): void => {
    if (basePath?.includes('doctor')) {
      navigate('/doctor');
    } else if (basePath?.includes('coordinator')) {
      navigate('/coordinator');
    } else {
      navigate('/nurse');
    }
  };

  return (
    <div className="nurse-dashboard-page">
      {/* Sidebar */}
      <aside className="nurse-sidebar" aria-label="Chat sidebar">
        <div className="nurse-sidebar-brand">
          <img className="nurse-sidebar-logo" src="/logo-white.png" alt="UIC logo" />
          <div className="nurse-sidebar-identity">
            <h3>{userName}</h3>
            <p>{campusName}</p>
          </div>
        </div>

        <nav className="nurse-sidebar-nav" aria-label="Chat navigation">
          <div className="nurse-nav-item">
            <button className="nurse-side-link" onClick={onMenuBack} type="button">
              <ArrowLeft className="nurse-side-icon" size={18} strokeWidth={2.2} />
              <span className="nurse-side-label">Back</span>
            </button>
          </div>
          <div className="nurse-nav-item">
            <button className="nurse-side-link active" type="button">
              <MessageSquare className="nurse-side-icon" size={18} strokeWidth={2.2} />
              <span className="nurse-side-label">Global Chat</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main chat area */}
      <div className="nurse-dashboard-main">
        <section
          className="panel"
          style={{
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 40px)',
            overflow: 'hidden',
            borderRadius: '12px',
          }}
        >
          {/* Header */}
          <header
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.875rem',
              background: '#fff',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #d44974 0%, #b83a61 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(212, 73, 116, 0.25)',
              }}
            >
              <Users size={20} strokeWidth={2} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                }}
              >
                UIC Clinic Global Chat
              </h2>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '0.8rem',
                  color: '#64748b',
                }}
              >
                Nurses · Doctors · Coordinators · All campuses
              </p>
            </div>

            <button
              className="button ghost"
              type="button"
              onClick={() => void loadMessages()}
              disabled={loading}
              title="Refresh messages"
              style={{ flexShrink: 0 }}
            >
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            </button>
          </header>

          {/* Messages Body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {loading && messages.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center' }}>Loading messages...</p>
            ) : messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: '#94a3b8' }}>
                <MessageSquare size={48} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: m.from_me ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end',
                    gap: '0.5rem',
                    width: '100%',
                  }}
                >
                  {!m.from_me && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: '#e2e8f0',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(m.sender_name)}
                    </div>
                  )}

                  <div
                    style={{
                      maxWidth: '60%',
                      padding: '0.65rem 1rem',
                      borderRadius: m.from_me ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: m.from_me ? '#d44974' : '#fff',
                      color: m.from_me ? '#fff' : '#0f172a',
                      border: m.from_me ? 'none' : '1px solid #e2e8f0',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      fontSize: '0.9rem',
                    }}
                  >
                    {!m.from_me && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <strong style={{ fontSize: '0.8rem', color: '#d44974' }}>{m.sender_name}</strong>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'capitalize' }}>{m.sender_role}</span>
                      </div>
                    )}
                    
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                    
                    <div
                      style={{
                        fontSize: '0.65rem',
                        color: m.from_me ? 'rgba(255,255,255,0.7)' : '#94a3b8',
                        marginTop: '0.25rem',
                        textAlign: 'right',
                      }}
                    >
                      {formatDateTime(m.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={handleSend}
            style={{
              padding: '1rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: '0.75rem',
              background: '#fff',
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              maxLength={2000}
              placeholder="Message the whole clinic..."
              disabled={sending}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                borderRadius: '24px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                outline: 'none',
                background: '#f8fafc',
              }}
            />
            <button
              className="button primary"
              type="submit"
              disabled={sending || newMessage.trim() === ''}
              style={{
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                flexShrink: 0,
              }}
            >
              <Send size={18} style={{ marginLeft: '-2px' }} />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}