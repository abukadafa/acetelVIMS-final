import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { 
  BookOpen, CheckCircle, Clock, AlertCircle, 
  Star, Users, Download, RefreshCw, Edit3, Eye, Search, BarChart3,
  TrendingUp, Award, ClipboardCheck, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import LogbookForm from '../components/LogbookForm';
import LogbookReviewModal from '../components/LogbookReviewModal';

/* ── Types ────────────────────────────────────────────────────── */
interface LogbookEntry {
  _id: string;
  entryDate: string;
  activities: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  supervisorRating?: number;
  supervisorComment?: string;
  weekNumber: number;
  attachments: string[];
  student: any;
}

interface SupervisorStudent {
  _id: string;
  user: { firstName: string; lastName: string; email: string };
  matricNumber: string;
  programme: { name: string; code: string };
  logStats: {
    total: number;
    approved: number;
    pending: number;
    avgRating: number;
  };
}

interface PerformanceRecord {
  studentName: string;
  matric: string;
  entriesThisWeek: number;
  avgRating: number;
  status: string;
}

/* ═══════════════════════════════════════════════════════════════ */
export default function LogbookPage() {
  const { isRole } = useAuth();
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [supStudents, setSupStudents] = useState<SupervisorStudent[]>([]);
  const [performance, setPerformance] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  // States for modals & interactions
  const [selectedEntry, setSelectedEntry] = useState<LogbookEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<LogbookEntry | null>(null);
  const [reviewingEntry, setReviewingEntry] = useState<LogbookEntry | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isRole('student')) {
        const { data } = await api.get('/logbook', { params: { status: filterStatus } });
        setEntries(data.entries);
      } else if (isRole('supervisor')) {
        const [studentsRes, entriesRes] = await Promise.all([
          api.get('/logbook/supervisor/students'),
          api.get('/logbook', { params: { status: 'submitted' } }) // Pending reviews
        ]);
        setSupStudents(studentsRes.data.students);
        setEntries(entriesRes.data.entries);
      } else if (isRole('internship_coordinator', 'admin')) {
        const { data } = await api.get('/logbook/performance');
        setPerformance(data.performance);
      }
    } catch (err) {
      toast.error('Failed to synchronize logbook data');
    } finally {
      setLoading(false);
    }
  }, [isRole, filterStatus]);

  useEffect(() => { loadData(); }, [loadData, refresh]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="badge badge-green"><CheckCircle size={12} /> Approved</span>;
      case 'rejected': return <span className="badge badge-red"><AlertCircle size={12} /> Needs Revision</span>;
      case 'submitted': return <span className="badge badge-blue"><Clock size={12} /> Pending Review</span>;
      default: return <span className="badge badge-gray">Draft</span>;
    }
  };

  return (
    <div className="page-container animate-fade">
      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="badge-icon">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="page-title">Institutional Logbook Portal</h1>
            <p className="page-subtitle">Academic monitoring and technical skill assessment</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={() => setRefresh(r => r + 1)}>
            <RefreshCw size={18} />
          </button>
          {isRole('student') && (
            <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
              <Edit3 size={18} /> New Entry
            </button>
          )}
          {isRole('internship_coordinator', 'admin') && (
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Download size={18} /> Export Performance Report
            </button>
          )}
        </div>
      </div>

      {/* ── LOADING STATE ── */}
      {loading ? (
        <div className="page-loader"><div className="spinner spinner-lg" /></div>
      ) : (
        <div className="grid-sidebar-layout" style={{ gridTemplateColumns: isRole('student') ? '1fr 340px' : '1fr' }}>
          
          <main className="content-panel">
            {/* ── INTERNSHIP COORDINATOR VIEW ── */}
            {isRole('internship_coordinator', 'admin') && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title"><BarChart3 size={20} /> Weekly Performance Overview</h3>
                  <div className="badge badge-blue">Academic Week {Math.ceil(new Date().getDate()/7)}</div>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Student Personnel</th>
                        <th>Matric Number</th>
                        <th style={{ textAlign: 'center' }}>Weekly Entries</th>
                        <th style={{ textAlign: 'center' }}>Avg. Rating</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.map((p, i) => (
                        <tr key={i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>{p.studentName[0]}</div>
                              <div style={{ fontWeight: 600 }}>{p.studentName}</div>
                            </div>
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>{p.matric}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="progress-mini">
                              <div className="progress-fill" style={{ width: `${(p.entriesThisWeek/7)*100}%`, background: p.entriesThisWeek >= 5 ? 'var(--green)' : 'var(--amber)' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{p.entriesThisWeek} / 7</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--amber)', fontWeight: 700 }}>
                              <Star size={14} fill="var(--amber)" /> {p.avgRating || 'N/A'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                             <span className={`badge badge-${p.status === 'active' ? 'green' : 'amber'}`}>{p.status}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-xs btn-ghost">View Full Profile</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── SUPERVISOR VIEW ── */}
            {isRole('supervisor') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="card">
                   <div className="card-header">
                    <h3 className="card-title"><Users size={20} /> Assigned Trainees</h3>
                  </div>
                  <div className="student-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', padding: '16px' }}>
                    {supStudents.map(s => (
                      <div key={s._id} className="card" style={{ padding: '20px', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <div className="avatar" style={{ width: 44, height: 44 }}>{s.user.firstName[0]}</div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{s.user.firstName} {s.user.lastName}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{s.matricNumber}</div>
                            </div>
                          </div>
                          <div className="badge badge-outline" style={{ height: 'fit-content' }}>{s.programme.code}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                          <div className="stats-box">
                            <div style={{ color: 'var(--text-3)' }}>Completed</div>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{s.logStats.approved}</div>
                          </div>
                          <div className="stats-box">
                            <div style={{ color: 'var(--text-3)' }}>Avg. Rating</div>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--amber)' }}>{s.logStats.avgRating ? s.logStats.avgRating.toFixed(1) : 'N/A'}</div>
                          </div>
                        </div>
                        <div className="divider" style={{ margin: '16px 0' }} />
                        <button className="btn btn-sm btn-outline btn-primary" style={{ width: '100%' }}>View Records</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header" style={{ background: 'var(--surface-2)' }}>
                    <h3 className="card-title"><ClipboardCheck size={20} /> Pending Reviews</h3>
                    <span className="badge badge-amber badge-pill">{entries.length} REQUIRED</span>
                  </div>
                  <div className="pending-list">
                    {entries.map(e => (
                      <div key={e._id} className="pending-item" onClick={() => setReviewingEntry(e)}>
                         <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <div className="date-icon">
                              <span className="month">{new Date(e.entryDate).toLocaleString('default', {month: 'short'})}</span>
                              <span className="day">{new Date(e.entryDate).getDate()}</span>
                            </div>
                            <div>
                               <div style={{ fontWeight: 700 }}>{e.student?.user?.firstName} {e.student?.user?.lastName}</div>
                               <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>Week {e.weekNumber} • Submitted for technical review</div>
                            </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {e.activities}
                            </div>
                            <button className="btn btn-sm btn-primary">Review & Sign</button>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STUDENT VIEW ── */}
            {isRole('student') && (
              <div className="timeline-container">
                <div className="filter-bar">
                  <div className="search-bar" style={{ flex: 1 }}>
                    <Search size={16} className="search-icon" />
                    <input className="form-control" placeholder="Search in logbook entries..." />
                  </div>
                  <select 
                    className="form-control" 
                    style={{ width: '180px' }}
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                  >
                    <option value="">All Entries</option>
                    <option value="approved">Approved</option>
                    <option value="submitted">Submitted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="timeline">
                  {entries.length === 0 ? (
                    <div className="empty-state">
                       <ClipboardCheck size={48} className="empty-icon" />
                       <h3>Your logbook is empty</h3>
                       <p>Start recording your daily internship activities to receive credit.</p>
                       <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>Create First Entry</button>
                    </div>
                  ) : (
                    entries.map(e => (
                      <div key={e._id} className={`timeline-card status-${e.status}`}>
                        <div className="timeline-header">
                           <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <div className="entry-date">
                                {new Date(e.entryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </div>
                              {getStatusBadge(e.status)}
                           </div>
                           <div style={{ display: 'flex', gap: '8px' }}>
                              {e.status === 'rejected' && (
                                <button className="btn btn-xs btn-primary" onClick={() => setEditingEntry(e)}>
                                  <Edit3 size={14} /> Resolve & Edit
                                </button>
                              )}
                              <button className="btn btn-xs btn-ghost" onClick={() => setSelectedEntry(e)}>
                                <Eye size={14} /> Full View
                              </button>
                           </div>
                        </div>
                        <div className="timeline-body">
                          <p className="summary">{e.activities}</p>
                          {e.supervisorComment && (
                            <div className="supervisor-note">
                               <div className="note-header">
                                  <Award size={14} /> 
                                  <span>Supervisor Observation ({e.supervisorRating} ★)</span>
                               </div>
                               <p className="note-content">{e.supervisorComment}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </main>

          {/* ── SIDEBAR (Student Stats) ── */}
          {isRole('student') && (
            <aside className="sidebar-panels">
               <div className="card stats-panel">
                  <h4 className="panel-title">Progress Tracking</h4>
                  <div className="stat-row">
                    <span>Approved Days</span>
                    <strong>{entries.filter(e => e.status === 'approved').length}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Pending Review</span>
                    <strong>{entries.filter(e => e.status === 'submitted').length}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Current Week</span>
                    <strong>Week {entries[0]?.weekNumber || 1}</strong>
                  </div>
                  <div className="divider" />
                  <div className="stat-row total">
                     <span>Technical Competency</span>
                     <span style={{ color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Star size={14} fill="var(--amber)" />
                        {(entries.reduce((a,c)=>a+(c.supervisorRating||0),0)/ (entries.filter(e=>e.supervisorRating).length || 1)).toFixed(1)}
                     </span>
                  </div>
               </div>

               <div className="card tip-panel" style={{ background: 'linear-gradient(to bottom right, #eff6ff, #dbeafe)' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af', fontSize: '0.9rem', marginBottom: '8px' }}>
                    <TrendingUp size={16} /> Professional Tip
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                    Regularly logging your technical challenges and solutions helps your supervisor assess your critical thinking skills.
                  </p>
               </div>
            </aside>
          )}

        </div>
      )}

      {/* ── MODALS ── */}
      {(showAddForm || editingEntry) && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px', width: '95%' }}>
             <LogbookForm 
               editEntry={editingEntry}
               onCancel={() => { setShowAddForm(false); setEditingEntry(null); }}
               onComplete={() => { setShowAddForm(false); setEditingEntry(null); setRefresh(r => r+1); }} 
             />
          </div>
        </div>
      )}

      {reviewingEntry && (
        <LogbookReviewModal 
          entry={reviewingEntry} 
          onClose={() => setReviewingEntry(null)} 
          onSuccess={() => setRefresh(r => r + 1)} 
        />
      )}

      {selectedEntry && (
        <div className="modal-overlay" onClick={() => setSelectedEntry(null)}>
           <div className="modal-card" style={{ maxWidth: '600px', padding: '32px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Entry Details</h3>
                <button className="btn btn-ghost" onClick={() => setSelectedEntry(null)}><X /></button>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="info-item">
                   <label className="form-label">Date</label>
                   <div>{new Date(selectedEntry.entryDate).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                <div className="info-item">
                   <label className="form-label">Activities</label>
                   <div style={{ whiteSpace: 'pre-wrap', background: 'var(--surface-2)', padding: '16px', borderRadius: '8px' }}>{selectedEntry.activities}</div>
                </div>
                {selectedEntry.supervisorComment && (
                  <div className="info-item">
                    <label className="form-label">Supervisor Comment</label>
                    <div style={{ color: 'var(--primary)', fontWeight: 600 }}>{selectedEntry.supervisorComment}</div>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      <style>{`
        .grid-sidebar-layout { display: grid; gap: 24px; }
        .sidebar-panels { display: flex; flex-direction: column; gap: 24px; }
        .stats-panel { padding: 24px; }
        .panel-title { margin-bottom: 20px; font-size: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
        .stat-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.85rem; color: var(--text-2); }
        .stat-row strong { color: var(--text); }
        .stat-row.total { margin-top: 12px; padding-top: 12px; font-weight: 700; border-top: 1px dashed var(--border); color: var(--text); }

        .timeline { display: flex; flex-direction: column; gap: 16px; margin-top: 24px; }
        .timeline-card { border: 1px solid var(--border); border-radius: 12px; background: white; transition: all 0.2s; }
        .timeline-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .timeline-card.status-approved { border-left: 4px solid var(--green); }
        .timeline-card.status-rejected { border-left: 4px solid var(--red); background: #fffafb; }
        .timeline-card.status-submitted { border-left: 4px solid var(--blue); }
        
        .timeline-header { padding: 16px 20px; border-bottom: 1px solid var(--border-2); display: flex; justify-content: space-between; align-items: center; }
        .entry-date { font-weight: 700; color: var(--text-2); font-size: 0.95rem; }
        .timeline-body { padding: 20px; }
        .summary { font-size: 0.9rem; line-height: 1.6; color: var(--text-2); }
        
        .supervisor-note { margin-top: 16px; padding: 12px 16px; background: rgba(99, 102, 241, 0.05); border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.1); }
        .note-header { display: flex; alignItems: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: var(--primary); margin-bottom: 4px; text-transform: uppercase; }
        .note-content { font-size: 0.85rem; color: var(--primary); font-style: italic; }

        .pending-list { display: flex; flex-direction: column; }
        .pending-item { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid var(--border-2); cursor: pointer; transition: background 0.2s; }
        .pending-item:hover { background: var(--surface-2); }
        
        .date-icon { width: 44px; height: 44px; background: #fff; border: 1px solid var(--border); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
        .date-icon .month { font-size: 0.65rem; text-transform: uppercase; font-weight: 800; color: var(--text-3); }
        .date-icon .day { font-size: 1.1rem; font-weight: 800; color: var(--primary); }

        .progress-mini { width: 60px; height: 6px; background: var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 2px; }
        .progress-fill { height: 100%; transition: width 0.3s; }

        .filter-bar { display: flex; gap: 16px; margin-bottom: 24px; }
      `}</style>
    </div>
  );
}
