import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { ArrowLeft, User, Building2, BookOpen, Shield } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function StudentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [logbookSummary, setLogbookSummary] = useState<any>(null);

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
        <div>
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
            Use the Student list “Action” menu for edit, deactivate and audit trail.
          </div>
        </div>
      </div>
    </div>
  );
}

