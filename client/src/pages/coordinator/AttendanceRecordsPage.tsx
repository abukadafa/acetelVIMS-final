import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';
import { Camera, CheckCircle, XCircle, Search, Filter } from 'lucide-react';

export default function AttendanceRecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/attendance');
      setRecords(data.records || []);
    } catch {
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  const filtered = records.filter(r => {
    if (!search) return true;
    const term = search.toLowerCase();
    const name = `${r.student?.user?.firstName} ${r.student?.user?.lastName}`.toLowerCase();
    return name.includes(term) || r.student?.user?.email?.toLowerCase().includes(term);
  });

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Records</h1>
          <p className="page-subtitle">Institution-wide log of student check-ins and identity verification</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-3)' }} />
            <input 
              className="form-input" 
              style={{ paddingLeft: 36 }} 
              placeholder="Search by student name or email..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-outline" onClick={fetchRecords}>
            <Filter size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No attendance records found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Date</th>
                  <th>Time In</th>
                  <th>Method</th>
                  <th>Location Status</th>
                  <th>Selfie Verification</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const d = new Date(r.checkInTime);
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.student?.user?.firstName} {r.student?.user?.lastName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.student?.user?.email}</div>
                      </td>
                      <td>{d.toLocaleDateString()}</td>
                      <td>{d.toLocaleTimeString()}</td>
                      <td>{r.method?.toUpperCase()}</td>
                      <td>
                        {r.isValid ? (
                          <span className="badge badge-green" style={{ display: 'flex', gap: 4, width: 'fit-content' }}>
                            <CheckCircle size={12}/> Verified
                          </span>
                        ) : (
                          <span className="badge badge-amber" style={{ display: 'flex', gap: 4, width: 'fit-content' }}>
                            <XCircle size={12}/> Out of Range
                          </span>
                        )}
                        {r.distanceFromCompany && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Dev: {(r.distanceFromCompany * 1000).toFixed(0)}m</div>}
                      </td>
                      <td>
                        {r.photoUrl ? (
                          <button className="btn btn-sm btn-outline" onClick={() => setSelectedPhoto(r.photoUrl)}>
                            <Camera size={14} /> View Selfie
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No Photo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
    </div>
  );
}
