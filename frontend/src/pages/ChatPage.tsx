import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, RefreshCw, Search, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventoryBasePath } from '../lib/useInventoryBasePath';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { userDisplayName } from '../lib/format';
import { getErrorMessage } from '../lib/http';

interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string | null;
  campus_id: number | null;
  campus_name: string | null;
  last_message: { body: string; created_at: string | null; from_me: boolean } | null;
  unread_count: number;
}
interface Message {
  id: number;
  sender_id: number;
  recipient_id: number;
  body: string;
  read_at: string | null;
  created_at: string;
  from_me: boolean;
}

const POLL_INTERVAL_MS = 8000;

function initials(first: string, last: string): string {
  const a = (first ?? '').trim().charAt(0);
  const b = (last ?? '').trim().charAt(0);
  return (a + b).toUpperCase() || '?';
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { basePath } = useInventoryBasePath();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContactId, setActiveContactId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const userName = useMemo(() => userDisplayName(user), [user]);
  const campusName = useMemo(() => user?.campus ?? 'Campus not assigned', [user]);

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activeContactId) ?? null,
    [contacts, activeContactId],
  );

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.role ?? '').toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const groupedContacts = useMemo(() => {
    const groups = new Map<string, Contact[]>();
    filteredContacts.forEach((c) => {
      const key = c.campus_name ?? 'Unknown Campus';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    });
    return Array.from(groups.entries());
  }, [filteredContacts]);

  const loadContacts = useCallback(async () => {
    try {
      const res = await api.get<Contact[]>('/messages/contacts');
      const list = Array.isArray(res.data) ? res.data : [];
      setContacts(list);

      if (list.length > 0) {
        setActiveContactId((current) => current ?? list[0].id);
      }
    } catch (err) {
      void notifyError(getErrorMessage(err, 'Unable to load contacts.'), 'Load Failed');
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const loadThread = useCallback(
    async (contactId: number, silent = false) => {
      if (!silent) setLoadingThread(true);
      try {
        const res = await api.get<Message[]>(`/messages/thread/${contactId}`);
        setMessages(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (!silent) {
          void notifyError(getErrorMessage(err, 'Unable to load messages.'), 'Load Failed');
        }
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [],
  );

  const markThreadRead = useCallback(async (contactId: number) => {
    try {
      await api.post(`/messages/read/${contactId}`);
    } catch {
      // silent — non-critical
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  // When active contact changes: load thread, mark read, refresh contact list
  useEffect(() => {
    if (activeContactId === null) return;
    void loadThread(activeContactId);
    void markThreadRead(activeContactId).then(() => void loadContacts());
  }, [activeContactId, loadThread, markThreadRead, loadContacts]);

  // Polling — refresh thread + contacts every 8s
  useEffect(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
    }

    pollTimerRef.current = window.setInterval(() => {
      void loadContacts();
      if (activeContactId !== null) {
        void loadThread(activeContactId, true);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, [activeContactId, loadContacts, loadThread]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeContactId]);

  const handleSend = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!activeContactId || newMessage.trim() === '' || sending) return;

    const body = newMessage.trim();
    setSending(true);

    // Optimistic append
    const optimistic: Message = {
      id: -Date.now(),
      sender_id: user?.id ?? 0,
      recipient_id: activeContactId,
      body,
      read_at: null,
      created_at: new Date().toISOString(),
      from_me: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMessage('');

    try {
      const res = await api.post<Message>('/messages', {
        recipient_id: activeContactId,
        body,
      });
      // Replace optimistic with real
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? res.data : m)));
      void loadContacts();
    } catch (err) {
      // Remove optimistic and restore text
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setNewMessage(body);
      void notifyError(getErrorMessage(err, 'Unable to send message.'), 'Send Failed');
    } finally {
      setSending(false);
    }
  };

  const onMenuBack = (): void => {
    if (basePath === '/doctor/inventory') {
      navigate('/doctor');
    } else if (basePath === '/nurse/inventory') {
      navigate('/nurse');
    } else {
      navigate(-1);
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
            <button
              className="nurse-side-link back-to-dashboard"
              onClick={onMenuBack}
              type="button"
            >
              <ArrowLeft className="nurse-side-icon" size={18} strokeWidth={2.2} />
              <span className="nurse-side-label">Back</span>
            </button>
          </div>
          <div className="nurse-nav-item">
            <button className="nurse-side-link active" type="button">
              <MessageSquare className="nurse-side-icon" size={18} strokeWidth={2.2} />
              <span className="nurse-side-label">Messages</span>
            </button>
          </div>
        </nav>
      </aside>

      <div className="nurse-dashboard-main">
        <section className="panel" style={{ padding: 0, display: 'flex', height: 'calc(100vh - 40px)', overflow: 'hidden' }}>
          {/* Contacts list */}
          <div
            style={{
              width: '320px',
              borderRight: '1px solid #eee',
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
            }}
          >
            <div style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Messages</h2>
              <div style={{ position: 'relative', marginTop: '0.75rem' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#999',
                  }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts..."
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.5rem 0.5rem 2.25rem',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                    fontSize: '0.9rem',
                  }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                            {loadingContacts ? (
                <p className="muted" style={{ padding: '1rem' }}>Loading contacts...</p>
              ) : groupedContacts.length === 0 ? (
                <p className="muted" style={{ padding: '1rem' }}>No contacts found.</p>
              ) : (
                groupedContacts.map(([campusLabel, campusContacts]) => (
                  <div key={campusLabel}>
                    <div
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#f7f7f7',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: '#888',
                        borderTop: '1px solid #eee',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      {campusLabel}
                    </div>
                    {campusContacts.map((c) => {
                      const isActive = c.id === activeContactId;
                      const preview = c.last_message
                        ? `${c.last_message.from_me ? 'You: ' : ''}${c.last_message.body}`
                        : 'No messages yet';
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setActiveContactId(c.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            padding: '0.75rem 1rem',
                            background: isActive ? '#fdf2f8' : 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #f3f3f3',
                            cursor: 'pointer',
                            textAlign: 'left',
                            gap: '0.75rem',
                          }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              background: '#d44974',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {initials(c.first_name, c.last_name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                              }}
                            >
                              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                {c.first_name} {c.last_name}
                              </span>
                              {c.last_message?.created_at ? (
                                <span className="muted small" style={{ fontSize: '0.7rem' }}>
                                  {formatTime(c.last_message.created_at)}
                                </span>
                              ) : null}
                            </div>
                            <div
                              className="muted small"
                              style={{
                                fontSize: '0.75rem',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                marginTop: '0.15rem',
                              }}
                            >
                              <span style={{ textTransform: 'capitalize' }}>{c.role ?? 'User'}</span>
                              {' · '}
                              {preview}
                            </div>
                          </div>
                          {c.unread_count > 0 ? (
                            <span
                              style={{
                                background: '#d44974',
                                color: '#fff',
                                borderRadius: 12,
                                padding: '0.1rem 0.5rem',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                            >
                              {c.unread_count}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
             </div>
           </div>
          {/* Thread panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
            {activeContact ? (
              <>
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: '#d44974',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                    }}
                  >
                    {initials(activeContact.first_name, activeContact.last_name)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {activeContact.first_name} {activeContact.last_name}
                    </div>
                    <div className="muted small" style={{ textTransform: 'capitalize' }}>
                      {activeContact.role ?? 'User'}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => {
                        void loadContacts();
                        void loadThread(activeContact.id);
                      }}
                      disabled={loadingThread}
                    >
                      <RefreshCw size={16} className={loadingThread ? 'spinning' : ''} />
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#fafafa' }}>
                  {loadingThread && messages.length === 0 ? (
                    <p className="muted">Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <p className="muted" style={{ textAlign: 'center', marginTop: '2rem' }}>
                      No messages yet. Start the conversation.
                    </p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: m.from_me ? 'flex-end' : 'flex-start',
                          marginBottom: '0.6rem',
                        }}
                      >
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
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                          <div
                            style={{
                              fontSize: '0.7rem',
                              opacity: 0.75,
                              marginTop: '0.2rem',
                              textAlign: 'right',
                            }}
                          >
                            {formatTime(m.created_at)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form
                  onSubmit={handleSend}
                  style={{
                    padding: '0.75rem 1rem',
                    borderTop: '1px solid #eee',
                    display: 'flex',
                    gap: '0.5rem',
                    background: '#fff',
                  }}
                >
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend(e as unknown as FormEvent<HTMLFormElement>);
                      }
                    }}
                    maxLength={2000}
                    placeholder="Type a message..."
                    disabled={sending}
                    style={{
                      flex: 1,
                      padding: '0.6rem 1rem',
                      borderRadius: '20px',
                      border: '1px solid #e0e0e0',
                      fontSize: '0.9rem',
                    }}
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
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#888',
                }}
              >
                Select a contact to start chatting
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}