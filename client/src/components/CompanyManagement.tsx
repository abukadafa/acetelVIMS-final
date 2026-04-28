import { useState, useEffect, useCallback } from 'react';
import { Building2, Search, MapPin, Users, Plus, ExternalLink, Upload, X, Globe, Settings, Pencil, Trash2, History } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'react-hot-toast';
import BulkEnrollModal from './BulkEnrollModal';
import AuditTrailModal from './AuditTrailModal';

interface Company {
  _id: string; name: string; address: string; state: string; sector: string;
  specialisation?: string; contactEmail?: string; contactPhone?: string;
  contactPerson?: string; website?: string; logo?: string;
  studentCount?: number; currentStudents?: number; maxStudents?: number;
  isApproved?: boolean; lat?: number; lng?: number;
}

const SECTORS = ['Artificial Intelligence', 'Cybersecurity', 'Information Technology', 'Software Development',
  'Data Science', 'Networking', 'Telecommunications', 'Management Information Systems', 'General IT'];

const NIGERIA_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River',
  'Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi',
  'Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara'];

export default function CompanyManagement() {
  const [companies, setCompanies]       = useState<Company[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [showBulkEnroll, setShowBulkEnroll] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState<Company | null>(null);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [auditTarget, setAuditTarget]   = useState<{ targetId?: string; title: string } | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [allocating, setAllocating]     = useState(false);
  const [form, setForm]                 = useState({
    name: '', address: '', state: 'FCT', sector: 'Information Technology',
    specialisation: '', contactEmail: '', contactPhone: '', contactPerson: '',
    website: '', maxStudents: 10, lat: 9.0765, lng: 7.3986,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/companies', { params: { search } });
      setCompanies(data.companies || []);
    } catch { toast.error('Failed to load partner organisations'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contactEmail) { toast.error('Contact email is required'); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/companies/${editingId}`, form);
        toast.success('Partner updated successfully');
      } else {
        await api.post('/companies', form);
        toast.success('Partner registered successfully');
      }
      setShowAddModal(false);
      setEditingId(null);
      setForm({ name: '', address: '', state: 'FCT', sector: 'Information Technology',
        specialisation: '', contactEmail: '', contactPhone: '', contactPerson: '',
        website: '', maxStudents: 10, lat: 9.0765, lng: 7.3986 });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || (editingId ? 'Failed to update partner' : 'Failed to register partner'));
    } finally { setSubmitting(false); }
  };

  const handleAutoAllocate = async (companyId: string) => {
    setAllocating(true);
    try {
      const { data } = await api.post(`/companies/${companyId}/auto-allocate`);
      toast.success(data.message || 'Students allocated successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Auto-allocation failed');
    } finally { setAllocating(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
    borderRadius: 8, fontSize: '0.88rem', outline: 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f9fafb',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.82rem', fontWeight: 700, color: '#374151',
    marginBottom: 5, display: 'block',
  };

  return (
    <div className="card animate-fade-in">
      {/* Header */}
      <div className="card-header" style={{ marginBottom: 24 }}>
        <h3 className="card-title"><Building2 size={20} /> ACETEL Industry Internship Placement Partners</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowBulkEnroll(true)}>
            <Upload size={16} /> Bulk Import
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingId(null); setShowAddModal(true); }}>
            <Plus size={16} /> Register Partner
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 24 }}>
        <div className="search-bar">
          <Search className="search-icon" size={18} />
          <input type="text" className="form-control" placeholder="Search by name, sector or state..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Grid */}
      <div className="grid-2" style={{ gap: 20 }}>
        {loading ? (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: 40 }}><div className="spinner spinner-lg" /></div>
        ) : companies.length === 0 ? (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: 48, color: '#6b7280' }}>
            <Building2 size={40} style={{ margin: '0 auto 12px', color: '#d1d5db' }} />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No partner organisations registered yet</div>
            <div style={{ fontSize: '0.85rem' }}>Click "Register Partner" to add the first one</div>
          </div>
        ) : companies.map(company => (
          <div key={company._id} className="card" style={{ border: '1.5px solid #e5e7eb', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: '#f0fdf4',
                  border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#166534', flexShrink: 0 }}>
                  <Building2 size={22} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: '#111827' }}>{company.name}</h4>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MapPin size={11} /> {company.address || company.state}
                  </div>
                </div>
              </div>
              <span style={{ background: company.isApproved ? '#f0fdf4' : '#fef9c3',
                color: company.isApproved ? '#166534' : '#854d0e',
                border: `1px solid ${company.isApproved ? '#bbf7d0' : '#fde047'}`,
                fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 100 }}>
                {company.isApproved ? 'Approved' : 'Pending'}
              </span>
            </div>

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Sector', company.sector],
                ['Specialisation', company.specialisation || 'General IT'],
                ['Contact', company.contactPerson || '—'],
                ['Email', company.contactEmail || '—'],
                ['Interns', `${company.currentStudents || 0} / ${company.maxStudents || 10}`],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                  <span style={{ color: '#6b7280' }}>{label}:</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8 }}>
              {company.website && (
                <button className="btn btn-sm btn-ghost" style={{ flex: 1 }}
                  onClick={() => window.open(company.website!.startsWith('http') ? company.website : `https://${company.website}`, '_blank')}>
                  <Globe size={13} /> Website
                </button>
              )}
              <button className="btn btn-sm btn-ghost" style={{ flex: 1 }}
                onClick={() => setShowManageModal(company)}>
                <Settings size={13} /> Manage
              </button>
              <button className="btn btn-sm btn-primary" style={{ flex: 1 }}
                onClick={() => handleAutoAllocate(company._id)} disabled={allocating}>
                <Users size={13} /> {allocating ? 'Allocating...' : 'Allocate Students'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Register/Edit Partner Modal ── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 640,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => { setShowAddModal(false); setEditingId(null); }} style={{ position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.3rem', fontWeight: 800,
              color: '#111827', marginBottom: 6 }}>{editingId ? 'Edit Industry Partner' : 'Register Industry Partner'}</h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 24 }}>
              {editingId ? 'Update this partner’s details' : 'Add a new ACETEL Industry Internship Placement Partner'}
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Organisation Name *</label>
                  <input style={inputStyle} required value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Andela Nigeria Ltd" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Full Address *</label>
                  <input style={inputStyle} required value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="No. 1, Example Street, Abuja" />
                </div>
                <div>
                  <label style={labelStyle}>State *</label>
                  <select style={inputStyle} value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                    {NIGERIA_STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Sector *</label>
                  <select style={inputStyle} value={form.sector}
                    onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>
                    {SECTORS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Area of Specialisation</label>
                  <input style={inputStyle} value={form.specialisation}
                    onChange={e => setForm(f => ({ ...f, specialisation: e.target.value }))}
                    placeholder="e.g. Machine Learning, Ethical Hacking" />
                </div>
                <div>
                  <label style={labelStyle}>Contact Email *</label>
                  <input style={inputStyle} type="email" required value={form.contactEmail}
                    onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                    placeholder="hr@company.com" />
                </div>
                <div>
                  <label style={labelStyle}>Contact Phone</label>
                  <input style={inputStyle} type="tel" value={form.contactPhone}
                    onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                    placeholder="+234..." />
                </div>
                <div>
                  <label style={labelStyle}>Contact Person</label>
                  <input style={inputStyle} value={form.contactPerson}
                    onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))}
                    placeholder="Mr. John Doe" />
                </div>
                <div>
                  <label style={labelStyle}>Website</label>
                  <input style={inputStyle} value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="www.company.com" />
                </div>
                <div>
                  <label style={labelStyle}>Max Interns Capacity</label>
                  <input style={inputStyle} type="number" min={1} max={100} value={form.maxStudents}
                    onChange={e => setForm(f => ({ ...f, maxStudents: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={labelStyle}>Latitude (for auto-allocation)</label>
                  <input style={inputStyle} type="number" step="0.0001" value={form.lat}
                    onChange={e => setForm(f => ({ ...f, lat: Number(e.target.value) }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => { setShowAddModal(false); setEditingId(null); }}
                  style={{ flex: 1, padding: 12, border: '1.5px solid #e5e7eb', borderRadius: 8,
                    fontWeight: 600, background: '#fff', cursor: 'pointer', color: '#374151' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  style={{ flex: 2, padding: 12, background: '#166534', color: '#fff',
                    border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
                    opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? (editingId ? 'Saving...' : 'Registering...') : (editingId ? 'Save Changes' : 'Register Partner')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manage Modal ── */}
      {showManageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative' }}>
            <button onClick={() => setShowManageModal(null)} style={{ position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.2rem', fontWeight: 800,
              color: '#111827', marginBottom: 20 }}>{showManageModal.name}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Address', showManageModal.address],
                ['State', showManageModal.state],
                ['Sector', showManageModal.sector],
                ['Contact Email', showManageModal.contactEmail || '—'],
                ['Contact Phone', showManageModal.contactPhone || '—'],
                ['Contact Person', showManageModal.contactPerson || '—'],
                ['Interns', `${showManageModal.currentStudents || 0} / ${showManageModal.maxStudents || 10}`],
                ['Status', showManageModal.isApproved ? 'Approved' : 'Pending Approval'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                  fontSize: '0.875rem', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#6b7280', fontWeight: 600 }}>{label}</span>
                  <span style={{ color: '#111827', fontWeight: 700 }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {showManageModal.website && (
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }}
                  onClick={() => window.open(showManageModal.website!.startsWith('http')
                    ? showManageModal.website : `https://${showManageModal.website}`, '_blank')}>
                  <ExternalLink size={14} /> Visit Website
                </button>
              )}
              <button className="btn btn-outline btn-sm" style={{ flex: 1 }}
                onClick={() => {
                  setEditingId(showManageModal._id);
                  setForm({
                    name: showManageModal.name || '',
                    address: showManageModal.address || '',
                    state: showManageModal.state || 'FCT',
                    sector: showManageModal.sector || 'Information Technology',
                    specialisation: showManageModal.specialisation || '',
                    contactEmail: showManageModal.contactEmail || '',
                    contactPhone: showManageModal.contactPhone || '',
                    contactPerson: showManageModal.contactPerson || '',
                    website: showManageModal.website || '',
                    maxStudents: showManageModal.maxStudents || 10,
                    lat: showManageModal.lat ?? 9.0765,
                    lng: showManageModal.lng ?? 7.3986,
                  });
                  setShowManageModal(null);
                  setShowAddModal(true);
                }}>
                <Pencil size={14} /> Edit
              </button>
              <button className="btn btn-outline btn-sm" style={{ flex: 1 }}
                onClick={() => {
                  setAuditTarget({ targetId: showManageModal._id, title: `Audit Trail — ${showManageModal.name}` });
                  setShowManageModal(null);
                }}>
                <History size={14} /> Audit
              </button>
              <button className="btn btn-outline btn-sm" style={{ flex: 1 }}
                onClick={() => { handleAutoAllocate(showManageModal._id); setShowManageModal(null); }}>
                <Users size={14} /> Allocate
              </button>
              <button className="btn btn-sm" style={{ flex: 1, border: '1.5px solid #fecaca', color: '#b91c1c', background: '#fff' }}
                onClick={async () => {
                  if (!confirm(`Delete ${showManageModal.name}?`)) return;
                  try {
                    await api.delete(`/companies/${showManageModal._id}`);
                    toast.success('Partner deleted');
                    setShowManageModal(null);
                    fetchData();
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || 'Failed to delete partner');
                  }
                }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {auditTarget && (
        <AuditTrailModal
          targetId={auditTarget.targetId}
          title={auditTarget.title}
          onClose={() => setAuditTarget(null)}
        />
      )}

      {showBulkEnroll && (
        <BulkEnrollModal onClose={() => setShowBulkEnroll(false)} onSuccess={fetchData} />
      )}
    </div>
  );
}
