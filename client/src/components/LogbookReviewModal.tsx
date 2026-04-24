import { useState } from 'react';
import { X, Star, FileText, CheckCircle, AlertCircle, BookOpen, Activity } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'react-hot-toast';

interface LogbookEntry {
  _id: string;
  entryDate: string;
  activities: string;
  toolsUsed?: string;
  skillsLearned?: string;
  challenges?: string;
  solutions?: string;
  attachments: string[];
  status: string;
  student: any;
}

interface Props {
  entry: LogbookEntry;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LogbookReviewModal({ entry, onClose, onSuccess }: Props) {
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(false);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !comment.trim()) {
      toast.error('Please provide a reason for the revision request');
      return;
    }

    setLoading(true);
    try {
      await api.put(`/logbook/${entry._id}/review`, {
        supervisorComment: comment,
        supervisorRating: rating,
        status
      });
      toast.success(status === 'approved' ? 'Logbook entry approved!' : 'Revision request sent');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card animate-zoom-in" style={{ maxWidth: '800px', width: '95%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="badge-icon" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ color: 'white' }}>Technical Review</h2>
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                Ref: {new Date(entry.entryDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ color: 'white' }}><X size={20} /></button>
        </div>

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', padding: '24px' }}>
          {/* Left: Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--primary)' }}>
                <Activity size={16} /> Major Activities
              </h4>
              <div className="content-box" style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: '12px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {entry.activities}
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <section>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Tools & Technologies</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {entry.toolsUsed?.split(',').map((t, i) => (
                    <span key={i} className="badge badge-outline" style={{ fontSize: '0.75rem' }}>{t.trim()}</span>
                  )) || 'No tools listed'}
                </div>
              </section>
              <section>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Skills Acquired</h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>{entry.skillsLearned || 'None specified'}</div>
              </section>
            </div>

            <section>
               <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--danger)' }}>
                <AlertCircle size={16} /> Challenges & Solutions
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <strong>Challenge:</strong> {entry.challenges || 'N/A'}
                </div>
                <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <strong>Solution:</strong> {entry.solutions || 'N/A'}
                </div>
              </div>
            </section>

            {entry.attachments && entry.attachments.length > 0 && (
              <section>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>Technical Evidence</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {entry.attachments.map((url, i) => (
                    <a key={i} href={`${import.meta.env.VITE_API_URL}${url}`} target="_blank" rel="noreferrer" className="evidence-preview">
                      <FileText size={24} />
                      <span>Attachment {i + 1}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right: Review Sidebar */}
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '16px', background: 'var(--bg-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div className="avatar">{entry.student?.user?.firstName?.[0]}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{entry.student?.user?.firstName} {entry.student?.user?.lastName}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{entry.student?.matricNumber}</div>
                </div>
              </div>
              <div className="divider" style={{ margin: '12px 0' }}></div>
              <div style={{ fontSize: '0.85rem' }}>
                <strong>Status:</strong> <span className={`badge badge-${entry.status === 'approved' ? 'green' : 'amber'}`}>{entry.status}</span>
              </div>
            </div>

            <section>
              <label className="form-label">Competency Rating</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                {[1, 2, 3, 4, 5].map(r => (
                  <button 
                    key={r} 
                    onClick={() => setRating(r)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <Star size={28} fill={r <= rating ? 'var(--amber)' : 'none'} color={r <= rating ? 'var(--amber)' : 'var(--border)'} />
                  </button>
                ))}
              </div>
            </section>

            <section>
              <label className="form-label">Technical Remark / Feedback</label>
              <textarea 
                className="form-control" 
                style={{ minHeight: '120px', fontSize: '0.9rem' }}
                placeholder="Provide constructive feedback..."
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </section>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', height: '48px' }}
                onClick={() => handleReview('approved')}
                disabled={loading}
              >
                {loading ? <div className="spinner" /> : <><CheckCircle size={18} /> Sign & Approve</>}
              </button>
              <button 
                className="btn btn-outline btn-danger" 
                style={{ width: '100%' }}
                onClick={() => handleReview('rejected')}
                disabled={loading}
              >
                Request Revision
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .evidence-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 12px;
          background: var(--surface-2);
          border-radius: 8px;
          border: 1px solid var(--border);
          text-decoration: none;
          color: var(--text-2);
          font-size: 0.7rem;
          width: 80px;
          transition: all 0.2s;
        }
        .evidence-preview:hover {
          border-color: var(--primary);
          background: white;
          color: var(--primary);
        }
        .content-box {
          border-left: 4px solid var(--primary);
        }
      `}</style>
    </div>
  );
}
