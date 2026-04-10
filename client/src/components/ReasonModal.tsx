import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ReasonModalProps {
  title: string;
  message: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  confirmText?: string;
  loading?: boolean;
}

export default function ReasonModal({ 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirm',
  loading = false
}: ReasonModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onCancel}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', marginBottom: '16px' }}>{message}</p>
            
            <div className="form-group">
              <label className="form-label">Justification / Reason <span style={{ color: 'red' }}>*</span></label>
              <textarea
                className="form-control"
                placeholder="e.g. Staff reassignment, Disciplinary action, Error correction..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
                autoFocus
                style={{ minHeight: '100px' }}
              />
              <p className="form-hint" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={12} /> This action will be logged in the permanent audit trail.
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onCancel} disabled={loading}>Cancel</button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={!reason.trim() || loading}
            >
              {loading ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
