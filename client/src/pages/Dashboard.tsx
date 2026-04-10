import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import AuditTrailModal from '../components/AuditTrailModal';
import AttendanceBiometric from '../components/AttendanceBiometric';
import MapDashboard from '../components/MapDashboard';
import WeeklyEvaluationForm from '../components/WeeklyEvaluationForm';
import { MapPin, Users, Activity, FileText, Settings, History, CheckSquare, Square, Shield, BookOpen, ChevronRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function Dashboard() {
  const { user, isRole, student } = useAuth();
  const [refresh, setRefresh] = useState(0);
  const [evaluatingStudent, setEvaluatingStudent] = useState<{id: string, name: string} | null>(null);

  /* ── Admin Dashboard Filters ── */
  const [showFilters, setShowFilters] = useState(false);
  const [showGlobalAudit, setShowGlobalAudit] = useState(false);
  const [tempAudit, setTempAudit] = useState<any[]>([]);
  const [visibleRoles, setVisibleRoles] = useState<string[]>(() => {
    const saved = localStorage.getItem('dashboard_visible_roles');
    return saved ? JSON.parse(saved) : ['admin', 'prog_coordinator', 'internship_coordinator', 'supervisor', 'ict_support'];
  });

  useEffect(() => {
    if (isRole('admin')) {
      api.get('/admin/audit-logs', { params: { limit: 5 } })
        .then((r: any) => setTempAudit(r.data.logs))
        .catch(() => {});
    }
  }, [refresh, isRole]);

  useEffect(() => {
    localStorage.setItem('dashboard_visible_roles', JSON.stringify(visibleRoles));
  }, [visibleRoles]);

  const toggleRole = (role: string) => {
    setVisibleRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const ALL_STAFF_ROLES = [
    { id: 'admin', label: 'Administrators' },
    { id: 'prog_coordinator', label: 'Prog. Coordinators' },
    { id: 'internship_coordinator', label: 'Internship Coordinators' },
    { id: 'supervisor', label: 'Supervisors' },
    { id: 'ict_support', label: 'ICT Support' },
  ];

  if (!user) return null;

  return (
    <div className="dashboard-container animate-fade">
      {/* Institutional Header */}
      <div className="card-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ marginBottom: '4px' }}>Welcome!</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {(isRole('admin')) && (
            <>
              <button 
                className={`btn ${showFilters ? 'btn-primary' : 'btn-outline'}`} 
                onClick={() => setShowFilters(!showFilters)}
                title="Dashboard Settings"
              >
                <Settings size={18} />
              </button>
              <button className="btn btn-outline" onClick={() => setShowGlobalAudit(true)}>
                <History size={18} /> Generate Audit Trail
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}><FileText size={18} /> Export Reports</button>
            </>
          )}
          {isRole('student') && (
            <div className="badge badge-green">Matric: {student?.matricNumber}</div>
          )}
        </div>
      </div>

      {/* Admin Filter Panel */}
      {showFilters && isRole('admin', 'prog_coordinator', 'internship_coordinator') && (
        <div className="card animate-slide-down" style={{ marginBottom: '24px', padding: '16px 20px', background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
             <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-2)' }}>Dashboard Visibility Settings</h4>
             <button className="btn btn-xs btn-ghost" onClick={() => setVisibleRoles(ALL_STAFF_ROLES.map(r => r.id))}>Reset to Default</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {ALL_STAFF_ROLES.map(role => (
              <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <div onClick={() => toggleRole(role.id)}>
                  {visibleRoles.includes(role.id) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                </div>
                {role.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Admin / Institutional View */}
      {(isRole('admin')) && (
        <>
          <AnalyticsDashboard key={`analytics-${refresh}`} visibleRoles={visibleRoles} />
          <div className="grid-2" style={{ marginTop: '28px' }}>
            <MapDashboard />
            
            {isRole('admin') && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title"><Shield size={18} /> Recent Security & Access</h3>
                  <button className="btn btn-sm btn-ghost" onClick={() => setShowGlobalAudit(true)}>View All</button>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tempAudit.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px' }}>No recent security events</div>
                  ) : (
                    tempAudit.map((log: any) => (
                      <div key={log._id} style={{ padding: '10px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                           <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{log.action.replace('_', ' ')}</span>
                           <span style={{ color: 'var(--text-3)' }}>{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <div style={{ color: 'var(--text-2)' }}>{log.details}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '4px' }}>
                          By {log.user?.firstName} {log.user?.lastName} • {log.ipAddress || 'Internal'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Programme Coordinator View */}
      {isRole('prog_coordinator') && (
        <div style={{ marginTop: '24px' }}>
          <div className="card-header" style={{ marginBottom: '16px' }}>
             <h2 className="card-title">Programme Oversight: {user.programme?.name || 'Assigned Programme'}</h2>
          </div>
          <AnalyticsDashboard key={`analytics-prog-${refresh}`} />
        </div>
      )}

      {/* Supervisor View */}
      {isRole('supervisor') && (
        <>
          {evaluatingStudent && (
            <div className="modal-overlay">
              <WeeklyEvaluationForm 
                studentId={evaluatingStudent.id}
                studentName={evaluatingStudent.name}
                onClose={() => setEvaluatingStudent(null)}
                onSuccess={() => setRefresh(prev => prev + 1)}
              />
            </div>
          )}
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title"><Users size={18} /> Assigned Students</h3>
                <button className="btn btn-sm btn-ghost" onClick={() => setRefresh(prev => prev + 1)}>Refresh</button>
              </div>
              <div className="student-list" style={{ marginTop: '16px' }}>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Programme</th>
                        <th>Logbooks</th>
                        <th>Risk</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: 'var(--bg-2)' }}>
                        <td style={{ fontWeight: 600 }}>Tunde Oke (Student)</td>
                        <td style={{ fontSize: '0.85rem' }}>MSc Cyber Security</td>
                        <td>12 / 14</td>
                        <td><span className="badge badge-green">Low</span></td>
                        <td>
                          <button 
                            className="btn btn-sm btn-primary"
                            onClick={() => setEvaluatingStudent({ id: 'demo-student-id', name: 'Tunde Oke' })}
                          >
                            Evaluate
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title"><Activity size={18} /> Pending Logbook Reviews</h3>
                <span className="badge badge-amber badge-pill">2 Pending</span>
              </div>
              <div className="activity-list" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="card" style={{ padding: '12px', border: '1px solid var(--border-2)', background: 'var(--bg-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>Tunde Oke • Week 3</div>
                      <div style={{ fontWeight: 600 }}>Tuesday Logbook Entry</div>
                    </div>
                    <button className="btn btn-sm btn-primary">Review</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Student View */}
      {isRole('student') && (
        <div className="grid-2">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <AttendanceBiometric onComplete={() => setRefresh(prev => prev + 1)} />
            
            <div className="card" style={{ padding: '32px', textAlign: 'center', background: 'linear-gradient(135deg, white 0%, #f9fafb 100%)' }}>
               <div className="badge-icon" style={{ margin: '0 auto 16px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                  <BookOpen size={32} />
               </div>
               <h3>Institutional Logbook</h3>
               <p style={{ color: 'var(--text-3)', fontSize: '0.9rem', marginBottom: '24px' }}>
                 Your daily technical log is the primary record of your internship. Keep it updated to ensure academic credit.
               </p>
               <Link to="/logbook" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Open Logbook Hub <ChevronRight size={18} />
               </Link>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Internship Details</h3>
                <div className={`badge badge-${student?.status === 'active' ? 'green' : 'amber'}`}>
                  {student?.status?.toUpperCase()}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="info-row">
                  <div className="form-label" style={{ marginBottom: '2px' }}>Assigned Company</div>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={16} /> {(student?.company as any)?.name || 'Allocation Pending'}
                  </div>
                </div>
                <div className="info-row">
                   <div className="form-label" style={{ marginBottom: '2px' }}>Assigned Supervisor</div>
                   <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span>{(student?.supervisor as any)?.firstName ? `${(student?.supervisor as any).firstName} ${(student?.supervisor as any).lastName}` : 'Not yet assigned'}</span>
                   </div>
                </div>
                <div className="divider"></div>
                <div className="info-row">
                   <div className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      Program Progress
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>45%</span>
                   </div>
                   <div className="progress-bar" style={{ marginTop: '8px' }}>
                     <div className="progress-fill" style={{ width: '45%' }}></div>
                   </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="card-header">
                <h3 className="card-title"><TrendingUp size={18} /> Technical Insights</h3>
                <Link to="/logbook" className="btn btn-xs btn-ghost">Stats</Link>
              </div>
              <div style={{ padding: '0 4px 12px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '8px' }}>Recent activities are helping you gain "Network Security" competencies.</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                     <span className="badge badge-outline" style={{ fontSize: '0.65rem' }}>Python</span>
                     <span className="badge badge-outline" style={{ fontSize: '0.65rem' }}>Cisco</span>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Global Audit Modal */}
      {showGlobalAudit && (
        <AuditTrailModal onClose={() => setShowGlobalAudit(false)} title="Institutional Audit Trail" />
      )}
    </div>
  );
}
