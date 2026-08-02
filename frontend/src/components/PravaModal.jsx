import React from 'react';
import { apiRequest } from '../api';
import { CreditCard, ExternalLink, X, ShieldCheck } from 'lucide-react';

export default function PravaModal({ info, onClose, showToast }) {
  if (!info) return null;

  const handleSimulateApprove = async () => {
    try {
      showToast('Simulating Prava payment approval...', 'info');
      await apiRequest(`/api/marketplace/purchase/${info.txId}/simulate-approval`, 'POST');
      await apiRequest(`/api/marketplace/purchase/${info.txId}/deliver`, 'POST');
      showToast('Mock payment approved. Asset delivered to Agent workspace.', 'success');
      onClose();
    } catch (err) {
      showToast(`Approval simulation failed: ${err.message}`, 'info');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '32px', maxWidth: '480px', width: '100%', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={20} color="var(--accent-blue)" /> Prava Payment Gateway
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Asset:</span>
            <strong>{info.title}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Price:</span>
            <strong style={{ color: 'var(--accent-cyan)' }}>${(info.priceCents / 100).toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Tx ID:</span>
            <code style={{ fontFamily: 'var(--font-mono)' }}>{info.txId}</code>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--accent-green)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px' }}>
            <ShieldCheck size={16} /> {info.isMock ? 'Mock Sandbox Session' : 'Prava Checkout Session'}
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            {info.isMock
              ? <>Prava could not be reached, so this local mock can be approved without a card.</>
              : <>Complete the real Prava checkout, then return to your agent and check the purchase status.</>}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {info.paymentUrl && (
              <a href={info.paymentUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-block">
                Open Prava Session Checkout <ExternalLink size={16} />
              </a>
            )}
            {info.isMock && (
              <button onClick={handleSimulateApprove} className="btn btn-secondary btn-block">
                Simulate Instant Payment Approval
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
