import React, { useState, useEffect } from 'react';
import { Search, Filter, MoreVertical, Download, UserPlus, CheckCircle, ExternalLink } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'react-hot-toast';

export default function StudentList() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ firstName: '', lastName: '', email: '', matricNumber: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filterProgramme]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsRes, progRes] = await Promise.all([
        api.get('/students', { params: { programme: filterProgramme, search } }),
        api.get('/students/programmes')
      ]);
      setStudents(studentsRes.data.students);
      setProgrammes(progRes.data.programmes);
    } catch (err) {
      toast.error('Failed to load student data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/admin/students', newStudent);
      toast.success(res.data.message);
      if (res.data.tempPassword) {
        alert(`Student created! Temporary Password: ${res.data.tempPassword}\nPlease share this with the student.`);
      }
      setShowAddModal(false);
      setNewStudent({ firstName: '', lastName: '', email: '', matricNumber: '', phone: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to onboard student');
    } finally {
      setSubmitting(false);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score > 70) return <span className="badge badge-red">High Risk</span>;
    if (score > 30) return <span className="badge badge-amber">Medium Risk</span>;
    return <span className="badge badge-green">Low Risk</span>;
  };

  return (
    <div className="card animate-fade-in">
      <div className="card-header" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h3 className="card-title"><UserPlus size={20} /> Active Students</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button 
             className="btn btn-sm btn-ghost" 
             onClick={() => window.open(`${api.defaults.baseURL}/students/export`, '_blank')}
             title="Export Students CSV"
           >
             <Download size={16} /> Export CSV
           </button>
           <button className="btn btn-sm btn-primary" onClick={() => setShowAddModal(true)}>Add Student</button>
        </div>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px' }}>
          <div className="search-bar">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search by name, matric, or email..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <select 
          className="form-control" 
          style={{ width: 'auto', minWidth: '200px' }}
          value={filterProgramme}
          onChange={e => setFilterProgramme(e.target.value)}
        >
          <option value="">All PG Programmes</option>
          {programmes.map(p => (
            <option key={p._id} value={p._id}>{p.name} ({p.level})</option>
          ))}
        </select>
        <button className="btn btn-ghost" onClick={() => { setSearch(''); setFilterProgramme(''); fetchData(); }}>
           <Filter size={18} /> Reset
        </button>
      </form>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Student Details</th>
              <th>Programme</th>
              <th>Matric Number</th>
              <th>Placement Status</th>
              <th>Risk Assessment</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>No students found Matching the criteria.</td></tr>
            ) : (
              students.map(student => (
                <tr key={student._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="avatar">{student.user.firstName[0]}{student.user.lastName[0]}</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{student.user.firstName} {student.user.lastName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{student.user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{student.programme.name}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{student.programme.level}</div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{student.matricNumber}</td>
                  <td>
                    {student.company ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--green)', fontWeight: 600, fontSize: '0.85rem' }}>
                        <CheckCircle size={14} /> {student.company.name}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--amber)', fontSize: '0.85rem', fontWeight: 600 }}>Awaiting Allocation</div>
                    )}
                  </td>
                  <td>{getRiskBadge(student.riskScore || 0)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                       <button className="btn btn-sm btn-ghost" title="View Profile"><ExternalLink size={14} /></button>
                       <button className="btn btn-sm btn-ghost" title="More Options"><MoreVertical size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Add Student Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-zoom-in" style={{ maxWidth: '500px' }}>
            <div className="card-header">
              <h3 className="card-title"><UserPlus size={18} /> Onboard New Student</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddStudent} style={{ marginTop: '20px' }}>
               <div className="grid-2">
                 <div className="form-group">
                   <label className="form-label">First Name</label>
                   <input required type="text" className="form-control" value={newStudent.firstName} onChange={e => setNewStudent({...newStudent, firstName: e.target.value})} />
                 </div>
                 <div className="form-group">
                   <label className="form-label">Last Name</label>
                   <input required type="text" className="form-control" value={newStudent.lastName} onChange={e => setNewStudent({...newStudent, lastName: e.target.value})} />
                 </div>
               </div>
               <div className="form-group">
                 <label className="form-label">Institutional Email</label>
                 <input required type="email" className="form-control" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} />
               </div>
               <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Matric Number</label>
                    <input required type="text" className="form-control" value={newStudent.matricNumber} onChange={e => setNewStudent({...newStudent, matricNumber: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input type="text" className="form-control" value={newStudent.phone} onChange={e => setNewStudent({...newStudent, phone: e.target.value})} />
                  </div>
               </div>
               <div className="divider" style={{ margin: '16px 0' }}></div>
               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                 <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
                 <button type="submit" className="btn btn-primary" disabled={submitting}>
                   {submitting ? 'Creating...' : 'Onboard Student'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
