import React, { useState } from 'react';
import api from '../lib/api';
import { toast } from 'react-hot-toast';
import { Save, X } from 'lucide-react';

interface Props {
  studentId: string;
  studentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WeeklyEvaluationForm({ studentId, studentName, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'monthly' as const,
    period: new Date().toLocaleString('default', { month: 'long' }),
    punctuality: 5,
    attitude: 5,
    technicalSkills: 5,
    communication: 5,
    initiative: 5,
    comments: ''
  });

  const metrics = [
    { key: 'punctuality', label: 'Punctuality & Reliability' },
    { key: 'attitude', label: 'Attitude to Work' },
    { key: 'technicalSkills', label: 'Technical Proficiency' },
    { key: 'communication', label: 'Communication Skills' },
    { key: 'initiative', label: 'Initiative & Creativity' }
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/supervisors/assessment', {
        studentId,
        ...formData
      });
      toast.success('Assessment submitted successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit assessment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card animate-scale-in" style={{ maxWidth: '600px', margin: 'auto' }}>
      <div className="card-header">
        <h3 className="card-title">Weekly Performance Evaluation</h3>
        <button onClick={onClose} className="btn-icon"><X size={20} /></button>
      </div>
      <div style={{ padding: '0 20px 10px 20px', fontSize: '0.9rem', color: 'var(--text-3)' }}>
        Evaluating: <strong>{studentName}</strong>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Assessment Type</label>
            <select 
              className="form-control" 
              value={formData.type} 
              onChange={e => setFormData({...formData, type: e.target.value as any})}
            >
              <option value="monthly">Monthly Review</option>
              <option value="mid_term">Mid-Term Assessment</option>
              <option value="final">Final Evaluation</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Period / Month</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. October 2024"
              value={formData.period}
              onChange={e => setFormData({...formData, period: e.target.value})}
              required
            />
          </div>
        </div>

        <div className="divider" style={{ margin: '0' }}></div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {metrics.map(m => (
            <div key={m.key} className="metric-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontWeight: 600, fontSize: '0.95rem' }}>{m.label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  step="1"
                  value={formData[m.key as keyof typeof formData] as number}
                  onChange={e => setFormData({...formData, [m.key]: parseInt(e.target.value)})}
                  style={{ width: '120px' }}
                />
                <span className="badge badge-primary" style={{ minWidth: '30px', textAlign: 'center' }}>
                  {formData[m.key as keyof typeof formData]}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="form-group">
          <label className="form-label">General Comments & Feedback</label>
          <textarea 
            className="form-control" 
            placeholder="How is the student performing? Mention specific technical milestones."
            value={formData.comments}
            onChange={e => setFormData({...formData, comments: e.target.value})}
            rows={3}
          />
        </div>

        <div className="modal-footer" style={{ padding: '0', marginTop: '10px' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <div className="spinner" /> : <><Save size={18} /> Submit Assessment</>}
          </button>
        </div>
      </form>
    </div>
  );
}
