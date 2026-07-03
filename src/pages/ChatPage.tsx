import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import SEO from '../components/SEO';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
}

export default function ChatPage() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const channel = supabase.channel('chat-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setMessages(data.reverse());
  };

  const sendMessage = async () => {
    if (!user || !input.trim() || sending) return;
    const now = Date.now();
    if (now - lastSent < 3000) return;
    if (input.length > 500) return;
    setSending(true);
    setLastSent(now);
    await supabase.from('chat_messages').insert({ user_id: user.id, username: user.username, message: input.trim() });
    setInput('');
    setSending(false);
  };

  return (
    <>
      <SEO title="Arcade Chat" />
      <div className="page container" style={{ maxWidth: 800 }}>
        <h1 className="section-title neon-text-green">Arcade Chat</h1>
        <div className="card neon-border" style={{ height: 450, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 40 }}>No messages yet. Be the first!</p>}
          {messages.map((msg) => (
            <div key={msg.id} style={{ padding: '8px 12px', borderRadius: 8, background: msg.user_id === user?.id ? 'rgba(0, 240, 255, 0.1)' : 'rgba(255, 0, 229, 0.05)', border: msg.user_id === user?.id ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(255, 0, 229, 0.2)', alignSelf: msg.user_id === user?.id ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <p style={{ fontSize: 12, color: 'var(--neon-blue)', marginBottom: 2 }}>{msg.username}</p>
              <p style={{ fontSize: 14 }}>{msg.message}</p>
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{new Date(msg.created_at).toLocaleTimeString()}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {user ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." maxLength={500} style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={sendMessage} disabled={sending || !input.trim()}>Send</button>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}><a href="/login" style={{ color: 'var(--neon-blue)' }}>Sign in</a> to chat</p>
        )}
      </div>
    </>
  );
}
