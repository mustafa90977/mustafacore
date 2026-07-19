'use client';

import { useState, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  externalId: string;
  direction: string;
  type: string;
  content: { text?: string; rawType?: string };
  status: string;
  timestamp: string;
  createdAt: string;
  customer: { id: string; phoneNumber: string; name: string | null; pushName: string | null } | null;
  conversationId: string;
}

export default function MessagesList() {
  const [instanceId, setInstanceId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!instanceId.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/messages?instanceId=${encodeURIComponent(instanceId.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to fetch messages');
        return;
      }

      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (!instanceId.trim()) return;

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [instanceId, fetchMessages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={instanceId}
          onChange={(e) => setInstanceId(e.target.value)}
          placeholder="Instance ID"
          style={{
            flex: 1,
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '0.25rem',
          }}
        />
        <button
          onClick={fetchMessages}
          disabled={loading || !instanceId.trim()}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '0.25rem',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          color: '#721c24',
        }}>
          {error}
        </div>
      )}

      {messages.length === 0 && !error && instanceId.trim() && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#666',
          border: '1px solid #dee2e6',
          borderRadius: '0.5rem',
        }}>
          No messages yet. Send a WhatsApp message to this instance to see it here.
        </div>
      )}

      {messages.length > 0 && (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #dee2e6',
          borderRadius: '0.5rem',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Customer</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Phone</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Message</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Time</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((msg) => (
              <tr key={msg.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '0.75rem' }}>
                  {msg.customer?.name || msg.customer?.pushName || 'Unknown'}
                </td>
                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>
                  {msg.customer?.phoneNumber || '-'}
                </td>
                <td style={{ padding: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {msg.content?.text || '[no text]'}
                </td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#666' }}>
                  {new Date(msg.timestamp).toLocaleString()}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    backgroundColor:
                      msg.status === 'DELIVERED' ? '#d4edda' :
                      msg.status === 'READ' ? '#cce5ff' :
                      msg.status === 'FAILED' ? '#f8d7da' : '#fff3cd',
                    color:
                      msg.status === 'DELIVERED' ? '#155724' :
                      msg.status === 'READ' ? '#004085' :
                      msg.status === 'FAILED' ? '#721c24' : '#856404',
                  }}>
                    {msg.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
