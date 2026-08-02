import React, { useState } from 'react';
import { Sparkles, X, Check } from 'lucide-react';

export default function MetadataReviewModal({ metadata, onConfirm, onCancel }) {
  const [category, setCategory] = useState(metadata.category || '');
  const [tags, setTags] = useState((metadata.tags || []).join(', '));
  const [capabilities, setCapabilities] = useState((metadata.capabilities || []).join(', '));
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm({
        category: category.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        capabilities: capabilities.split(',').map(c => c.trim()).filter(Boolean)
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '32px', maxWidth: '520px', width: '100%', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent-brand)" /> Review AI-Generated Metadata
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Derived from your uploaded file's actual contents. Adjust anything before publishing.
        </p>

        <div className="form-group">
          <label>Category</label>
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '14px' }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Capabilities (comma-separated)</label>
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '14px' }}
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Tags (comma-separated)</label>
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '14px' }}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button className="btn btn-secondary btn-block" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button className="btn btn-brand btn-block" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Publishing...' : <>Confirm & Publish <Check size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
