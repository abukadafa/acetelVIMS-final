import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { ArrowLeft, User, Building2, BookOpen, Shield, Pencil, Trash2, Camera as CameraIcon, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { NIGERIAN_STATES, getLgasForState, normalizeStateValue } from '../data/nigeria-locations';
import ReasonModal from '../components/ReasonModal';

export default function StudentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [logbookSummary, setLogbookSummary] = useState<any>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (student?._id) {
      api.get(`/attendance?studentId=${student._id}`)
        .then(({ data }) => setAttendanceRecords(data.records))
        .catch(() => toast.error('Failed to load attendance'));
    }
  }, [student?._id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/students/${id}`)
      .then(({ data }) => {
        setStudent(data.student);
        setLogbookSummary(data.logbookSummary);
      })
      .catch(() => toast.error('Failed to load student profile'))
      .finally(() => setLoading(false));
  }, [id]);

  const canManage = isRole('admin', 'prog_coordinator', 'internship_coordinator', 'ict_support');

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: 28 }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="page-container">
        <div className="card" style={{ padding: 28 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ marginTop: 16, color: '#6b7280' }}>Student not found.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade">
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 10 }}>
            <ArrowLeft size={14} /> Back to Students
          </button>
          <h1 className="page-title" style={{ margin: 0 }}>
            {student.user?.firstName} {student.user?.lastName}
          </h1>
          <p className="page-subtitle" style={{ marginTop: 6 }}>
            {student.matricNumber} • {student.programme?.name || '—'}
          </p>
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => setEditing(student)} disabled={saving}>
              <Pencil size={16} /> Edit
            </button>
            <button className="btn btn-danger" onClick={() => setDeleteOpen(true)} disabled={saving}>
              <Trash2 size={16} /> Deactivate
            </button>
          </div>
        )}
      </div>

      <div className="grid-2" style={{ gap: 18 }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><User size={18} /> Profile</h3>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 10 }}>
            <div><strong>Email:</strong> {student.user?.email || '—'}</div>
            <div><strong>Personal Email:</strong> {student.personalEmail || '—'}</div>
            <div><strong>Status:</strong> {student.status || 'pending'}</div>
            <div><strong>State/LGA:</strong> {(student.stateOfOrigin || '—')}{student.lga ? ` / ${student.lga}` : ''}</div>
            <div><strong>Address:</strong> {student.address || '—'}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Building2 size={18} /> Placement</h3>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 10 }}>
            <div><strong>Company:</strong> {student.company?.name || 'Unassigned'}</div>
            <div><strong>Supervisor:</strong> {student.supervisor ? `${student.supervisor.firstName} ${student.supervisor.lastName}` : '—'}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><BookOpen size={18} /> Logbook Summary</h3>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 10 }}>
            <div><strong>Total entries:</strong> {logbookSummary?.totalEntries ?? 0}</div>
            <div><strong>Approved:</strong> {logbookSummary?.approved ?? 0}</div>
            <div><strong>Pending review:</strong> {logbookSummary?.pending ?? 0}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Shield size={18} /> Admin Notes</h3>
          </div>
          <div className="card-body" style={{ color: '#6b7280' }}>
            Admins can edit or deactivate this student from the buttons above.
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-header">
          <h3 className="card-title">Attendance & Identity Verification History</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {attendanceRecords.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>No attendance records found.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time In</th>
                  <th>Method</th>
                  <th>Verification</th>
                  <th>Selfie</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.map((record, i) => {
                  const d = new Date(record.checkInTime);
                  return (
                    <tr key={i}>
                      <td>{d.toLocaleDateString()}</td>
                      <td>{d.toLocaleTimeString()}</td>
                      <td>{record.method?.toUpperCase()}</td>
                      <td>
                        {record.isValid ? (
                          <span className="badge badge-green" style={{ display: 'flex', gap: 4, width: 'fit-content' }}>
                            <CheckCircle size={12}/> Verified
                          </span>
                        ) : (
                          <span className="badge badge-amber" style={{ display: 'flex', gap: 4, width: 'fit-content' }}>
                            <XCircle size={12}/> Out of Range
                          </span>
                        )}
                        {record.distanceFromCompany && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Dev: {(record.distanceFromCompany * 1000).toFixed(0)}m</div>}
                      </td>
                      <td>
                        {record.photoUrl ? (
                          <button className="btn btn-sm btn-outline" onClick={() => setSelectedPhoto(record.photoUrl)}>
                            <CameraIcon size={14} /> View Selfie
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>No Photo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="modal" style={{ maxWidth: 400, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none', position: 'absolute', right: 0, zIndex: 10 }}>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedPhoto(null)} style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>✕</button>
            </div>
            <img src={api.defaults.baseURL?.replace('/api', '') + selectedPhoto} alt="Verification Selfie" style={{ width: '100%', display: 'block' }} />
            <div style={{ padding: 16, background: '#fff', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>Biometric Verification</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Captured securely via mobile device</div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal (reuse fields supported by /students/:id update) */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Student</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditing(null)}>✕</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                try {
                  await api.put(`/students/${student._id}`, {
                    status: editing.status,
                    personalEmail: editing.personalEmail,
                    stateOfOrigin: editing.stateOfOrigin,
                    lga: editing.lga,
                    address: editing.address,
                  });
                  toast.success('Student updated');
                  setEditing(null);
                  const { data } = await api.get(`/students/${student._id}`);
                  setStudent(data.student);
                  setLogbookSummary(data.logbookSummary);
                } catch (err: any) {
                  toast.error(err.response?.data?.error || 'Failed to update student');
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Status</label>
                  <select className="form-control form-select" value={editing.status || 'pending'}
                    onChange={(e) => setEditing((p: any) => ({ ...p, status: e.target.value }))}>
                    {['pending', 'active', 'completed', 'withdrawn', 'suspended'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Personal Email</label>
                  <input className="form-control" type="email" value={editing.personalEmail || ''}
                    onChange={(e) => setEditing((p: any) => ({ ...p, personalEmail: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">State of Origin</label>
                  <select className="form-control form-select" value={normalizeStateValue(editing.stateOfOrigin || '')}
                    onChange={(e) => setEditing((p: any) => ({ ...p, stateOfOrigin: e.target.value, lga: '' }))}>
                    <option value="">Select state…</option>
                    {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">LGA</label>
                  <select className="form-control form-select" disabled={!editing.stateOfOrigin} value={editing.lga || ''}
                    onChange={(e) => setEditing((p: any) => ({ ...p, lga: e.target.value }))}>
                    <option value="">Select LGA…</option>
                    {getLgasForState(normalizeStateValue(editing.stateOfOrigin || '')).map((lga: string) => (
                      <option key={lga} value={lga}>{lga}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <input className="form-control" value={editing.address || ''}
                    onChange={(e) => setEditing((p: any) => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteOpen && (
        <ReasonModal
          title="Deactivate student account?"
          message="Provide a reason. This will be recorded in the audit trail."
          confirmText="Deactivate"
          loading={saving}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={async (reason) => {
            setSaving(true);
            try {
              await api.delete(`/students/${student._id}`, { data: { reason } });
              toast.success('Student deactivated');
              navigate(-1);
            } catch (err: any) {
              toast.error(err.response?.data?.error || 'Failed to deactivate student');
            } finally {
              setSaving(false);
              setDeleteOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}

