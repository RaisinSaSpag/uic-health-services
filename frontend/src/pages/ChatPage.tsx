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

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

      <div className="nurse-dashboard-main">
        <section className="panel" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)' }}>
          {/* Header */}
          <div style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#fff' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#d44974', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>UIC Clinic Global Chat</h2>
              <p className="muted small" style={{ margin: 0 }}>All Nurses, Doctors, and Coordinators across all campuses.</p>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <button className="button ghost" type="button" onClick={() => void loadMessages()} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'spinning' : ''} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#fafafa' }}>
            {loading && messages.length === 0 ? (
              <p className="muted">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center', marginTop: '2rem' }}>
                No messages yet. Start the conversation!
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.from_me ? 'flex-end' : 'flex-start', marginBottom: '0.6rem' }}>
                  <div
                    style={{
                      maxWidth: '65%',
                      padding: '0.5rem 0.85rem',
                      borderRadius: '14px',
                      background: m.from_me ? '#d44974' : '#fff',
                      color: m.from_me ? '#fff' : '#333',
                      border: m.from_me ? 'none' : '1px solid #eee',
                      fontSize: '0.9rem',
                    }}
                  >
                    {!m.from_me && (
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: '0.2rem', color: '#d44974' }}>
                        {m.sender_name}{' '}
                        <span style={{ color: '#999', fontWeight: 400, textTransform: 'capitalize' }}>
                          ({m.sender_role})
                        </span>
                      </div>
                    )}
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.75, marginTop: '0.2rem', textAlign: 'right' }}>
                      {formatTime(m.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{ padding: '0.75rem 1rem', borderTop: '1px solid #eee', display: 'flex', gap: '0.5rem', background: '#fff' }}>
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              maxLength={2000}
              placeholder="Message the whole clinic..."
              disabled={sending}
              style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: '20px', border: '1px solid #e0e0e0', fontSize: '0.9rem' }}
            />
            <button
              className="button primary"
              type="submit"
              disabled={sending || newMessage.trim() === ''}
              style={{ borderRadius: '20px', padding: '0.6rem 1rem' }}
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}