'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type ConnectionStatus = 'idle' | 'connecting' | 'qr_pending' | 'connected' | 'disconnected' | 'error';

export default function WhatsAppConnect() {
  const [instanceId, setInstanceId] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [qrData, setQrData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollQR = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/qr?instanceId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.qr) {
        setQrData(data.qr);
        setStatus('qr_pending');
      }
    } catch {
      // silently retry on next poll
    }
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/status?instanceId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.isConnected) {
        setStatus('connected');
        setQrData(null);
      } else if (data.status === 'ERROR') {
        setStatus('error');
      }
    } catch {
      // silently retry
    }
  }, []);

  useEffect(() => {
    if (status !== 'connecting' && status !== 'qr_pending') return;

    const interval = setInterval(() => {
      if (!instanceId) return;
      if (status === 'connecting' || status === 'qr_pending') {
        pollQR(instanceId);
        pollStatus(instanceId);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, instanceId, pollQR, pollStatus]);

  async function handleConnect() {
    if (!instanceId.trim()) return;
    setError(null);
    setQrData(null);
    setStatus('connecting');

    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: instanceId.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to connect');
        setStatus('error');
        return;
      }

      if (data.status === 'CONNECTED') {
        setStatus('connected');
      } else {
        setStatus('qr_pending');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStatus('error');
    }
  }

  async function handleDisconnect() {
    if (!instanceId.trim()) return;
    setError(null);

    try {
      await fetch('/api/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: instanceId.trim() }),
      });
      setStatus('disconnected');
      setQrData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  }

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
          onClick={handleConnect}
          disabled={status === 'connecting' || status === 'qr_pending'}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#25d366',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
          }}
        >
          Connect
        </button>
        <button
          onClick={handleDisconnect}
          disabled={status === 'idle' || status === 'disconnected'}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
          }}
        >
          Disconnect
        </button>
      </div>

      <div style={{
        padding: '0.75rem',
        borderRadius: '0.25rem',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
      }}>
        Status: <strong>{status.toUpperCase()}</strong>
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

      {(status === 'connecting' || status === 'qr_pending') && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2rem',
          border: '1px solid #dee2e6',
          borderRadius: '0.5rem',
        }}>
          {qrData ? (
            <>
              <QRCodeSVG value={qrData} size={256} />
              <p style={{ marginTop: '1rem', color: '#666' }}>
                Scan with WhatsApp
              </p>
            </>
          ) : (
            <p style={{ color: '#666' }}>Waiting for QR code...</p>
          )}
        </div>
      )}

      {status === 'connected' && (
        <div style={{
          padding: '2rem',
          borderRadius: '0.5rem',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          color: '#155724',
          textAlign: 'center',
        }}>
          Connected!
        </div>
      )}
    </div>
  );
}
