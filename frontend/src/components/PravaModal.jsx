import React from 'react';
import { apiRequest } from '../api';
import { CreditCard, ExternalLink, X } from 'lucide-react';

export default function PravaModal({ info, onClose, showToast }) {
  if (!info) return null;

  const handleSimulateApprove = async () => {
    try {
      showToast('Simulating Prava payment approval...', 'info');
      await apiRequest(`/api/marketplace/purchase/${info.txId}/deliver`, 'POST');
      showToast('Payment Captured! Asset delivered to Agent workspace.', 'success');
      onClose();
    } catch (err) {
      showToast(`Approval simulation note: ${err.message}`, 'info');
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3><CreditCard size={18} inline="true" /> Prava Payment Gateway</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="payment-summary">
            <div className="summary-row">
              <span>Asset:</span>
              <strong>{info.title}</strong>
            </div>
            <div className="summary-row">
              <span>Price:</span>
              <strong className="accent-text">${(info.priceCents / 100).toFixed(2)}</strong>
            </div>
            <div className="summary-row">
              <span>Transaction ID:</span>
              <code style={{ fontSize: '0.8rem' }}>{info.txId}</code>
            </div>
          </div>

          <div className="prava-checkout-box">
            <p className="sandbox-note">🔒 <strong>Prava Sandbox Environment</strong></p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Click below to simulate approval with your Prava Sandbox Card (<code>4622943123232184</code>):</p>
            <div className="checkout-actions">
              <a href={info.paymentUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-block">
                Open Prava Session Checkout <ExternalLink size={16} />
              </a>
              <button onClick={handleSimulateApprove} className="btn btn-secondary btn-block">
                Simulate Instant Payment Approval
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
