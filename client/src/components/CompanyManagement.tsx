import { useState, useEffect, useCallback } from 'react';
import { Building2, Search, MapPin, Users, Plus, ExternalLink, Upload, X, Globe, Pencil, Trash2, History, Send, MoreVertical, Eye, UserCheck, LayoutGrid, List } from 'lucide-react';
import api from '../lib/api';
import { apiErrorMessage } from '../lib/errors';
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
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [sendingPartnerEmail, setSendingPartnerEmail] = useState(false);
  const [openCompanyMenu, setOpenCompanyMenu] = useState<string | null>(null);
  const [viewMode, setViewMode]         = useState<'grid' | 'table'>('grid');
  const [form, setForm]                 = useState({
    name: '', address: '', state: 'FCT', sector: 'Information Technology',
    specialisation: '', contactEmail: '', contactPhone: '', contactPerson: '',
    website: '', maxStudents: 10, lat: 9.0765, lng: 7.3986,
  });

  useEffect(() => {
    if (!openCompanyMenu) return;
    const timer = setTimeout(() => {
      const handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('[data-company-action-menu]')) {
          return;
        }
        setOpenCompanyMenu(null);
      };
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }, 50);
    return () => clearTimeout(timer);
  }, [openCompanyMenu]);

  const handleCompanyAction = async (action: string, company: Company) => {
    setOpenCompanyMenu(null);
    switch (action) {
      case 'manage':
        setShowManageModal(company);
        break;
      case 'resend-email':
        handleResendPartnerEmail([company._id]);
        break;
      case 'allocate':
        handleAutoAllocate(company._id);
        break;
      case 'edit':
        setEditingId(company._id);
        setForm({
          name: company.name || '',
          address: company.address || '',
          state: company.state || 'FCT',
          sector: company.sector || 'Information Technology',
          specialisation: company.specialisation || '',
          contactEmail: company.contactEmail || '',
          contactPhone: company.contactPhone || '',
          contactPerson: company.contactPerson || '',
          website: company.website || '',
          maxStudents: company.maxStudents || 10,
          lat: company.lat ?? 9.0765,
          lng: company.lng ?? 7.3986,
        });
        setShowAddModal(true);
        break;
      case 'audit':
        setAuditTarget({ targetId: company._id, title: `Audit Trail — ${company.name}` });
        break;
      case 'website':
        if (company.website) {
          window.open(company.website.startsWith('http') ? company.website : `https://${company.website}`, '_blank');
        }
        break;
      case 'delete':
        if (!confirm(`Delete ${company.name}?`)) return;
        try {
          await api.delete(`/companies/${company._id}`);
          toast.success('Partner deleted');
          fetchData();
        } catch (err: any) {
          toast.error(err.response?.data?.error || 'Failed to delete partner');
        }
        break;
    }
  };

  const renderActionDropdown = (company: Company, menuKey: string, align: 'right' | 'left' = 'right', position: 'down' | 'up' = 'down') => {
    if (openCompanyMenu !== menuKey) return null;
    const items = [
      { action: 'manage',       icon: Eye,         label: 'View / Manage Details' },
      { action: 'resend-email',  icon: Send,        label: 'Resend Onboarding Email' },
      { action: 'allocate',      icon: UserCheck,   label: 'Allocate Students' },
      { action: 'edit',          icon: Pencil,      label: 'Edit Partner' },
      { action: 'audit',         icon: History,     label: 'Audit Trail' },
      ...(company.website ? [{ action: 'website', icon: Globe, label: 'Visit Website' }] : []),
      { action: 'delete',        icon: Trash2,      label: 'Delete Partner' },
    ];

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          [align]: 0,
          ...(position === 'up' ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
          zIndex: 9999,
          background: '#fff',
          border: '1.5px solid #e5e7eb',
          borderRadius: 10,
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          minWidth: 220,
          overflow: 'hidden',
        }}
      >
        {items.map(({ action, icon: Icon, label }) => (
          <button
            key={action}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCompanyAction(action, company);
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: action === 'delete' ? '#dc2626' : '#111827',
              textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Icon size={15} color={action === 'delete' ? '#dc2626' : '#166534'} />
            {label}
          </button>
        ))}
      </div>
    );
  };

  const handleResendPartnerEmail = async (ids: string[]) => {
    if (ids.length === 0) return;
    setSendingPartnerEmail(true);
    try {
      const { data } = await api.post('/companies/send-enrollment-emails', {
        companyIds: ids,
      });
      toast.success(data?.message || `Onboarding email sent to ${ids.length} partner(s)`);
      setSelectedCompanies([]);
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Failed to send onboarding email'));
    } finally {
      setSendingPartnerEmail(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/companies', {
        params: search.trim() ? { search: search.trim() } : undefined,
      });
      setCompanies(data.companies || []);
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to load partner organisations'); }
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
      toast.error(apiErrorMessage(err, editingId ? 'Failed to update partner' : 'Failed to register partner'));
    } finally { setSubmitting(false); }
  };

  const handleAutoAllocate = async (companyId: string) => {
    setAllocating(true);
    try {
      const { data } = await api.post(`/companies/${companyId}/auto-allocate`);
      toast.success(
        data.pendingApproval
          ? data.message || 'Students matched — approve each posting to send emails'
          : data.message || 'Students allocated successfully'
      );
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

      {/* Search & View Switcher */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 260 }}>
          <Search className="search-icon" size={18} />
          <input type="text" className="form-control" placeholder="Search by name, sector or state..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', background: '#f3f4f6', padding: 3, borderRadius: 8, gap: 2 }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: 6,
              background: viewMode === 'grid' ? '#fff' : 'transparent',
              color: viewMode === 'grid' ? '#166534' : '#6b7280',
              boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid size={15} /> Grid
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: 6,
              background: viewMode === 'table' ? '#fff' : 'transparent',
              color: viewMode === 'table' ? '#166534' : '#6b7280',
              boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
            onClick={() => setViewMode('table')}
          >
            <List size={15} /> Table
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedCompanies.length > 0 && (
        <div style={{
          background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8,
          padding: '10px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 20
        }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#166534' }}>
            ✓ {selectedCompanies.length} partner organisation{selectedCompanies.length > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              style={{ background: '#166534', borderColor: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}
              disabled={sendingPartnerEmail}
              onClick={() => handleResendPartnerEmail(selectedCompanies)}
            >
              <Send size={14} /> {sendingPartnerEmail ? 'Sending...' : `Resend Onboarding Email (${selectedCompanies.length})`}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setSelectedCompanies([])}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner spinner-lg" /></div>
      ) : companies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
          <Building2 size={40} style={{ margin: '0 auto 12px', color: '#d1d5db' }} />
          <div style={{ fontWeight: 700, marginBottom: 4 }}>No partner organisations registered yet</div>
          <div style={{ fontSize: '0.85rem' }}>Click "Register Partner" to add the first one</div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid-2" style={{ gap: 20 }}>
          {companies.map(company => {
            const isSelected = selectedCompanies.includes(company._id);
            return (
            <div key={company._id} className="card" style={{ border: `1.5px solid ${isSelected ? '#86efac' : '#e5e7eb'}`, background: isSelected ? '#f0fdf4' : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${company.name}`}
                    checked={isSelected}
                    onChange={() => {
                      setSelectedCompanies(prev =>
                        prev.includes(company._id) ? prev.filter(id => id !== company._id) : [...prev, company._id]
                      );
                    }}
                    style={{ marginTop: 12, accentColor: '#166534', cursor: 'pointer', transform: 'scale(1.15)' }}
                  />
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: company.isApproved ? '#f0fdf4' : '#fef9c3',
                    color: company.isApproved ? '#166534' : '#854d0e',
                    border: `1px solid ${company.isApproved ? '#bbf7d0' : '#fde047'}`,
                    fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 100 }}>
                    {company.isApproved ? 'Approved' : 'Pending'}
                  </span>
                  <div data-company-action-menu style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      aria-label={`Actions for ${company.name}`}
                      style={{
                        padding: '5px 7px',
                        borderRadius: 6,
                        border: openCompanyMenu === `${company._id}-header` ? '1.5px solid #166534' : '1px solid #e5e7eb',
                        background: openCompanyMenu === `${company._id}-header` ? '#f0fdf4' : '#fff',
                        color: openCompanyMenu === `${company._id}-header` ? '#166534' : '#4b5563',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenCompanyMenu(prev => prev === `${company._id}-header` ? null : `${company._id}-header`);
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {renderActionDropdown(company, `${company._id}-header`, 'right', 'down')}
                  </div>
                </div>
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

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-primary" style={{ flex: 1.2 }}
                  onClick={() => handleAutoAllocate(company._id)} disabled={allocating}>
                  <Users size={13} /> {allocating ? 'Allocating...' : 'Allocate Students'}
                </button>
                <button className="btn btn-sm btn-outline" style={{ flex: 1, borderColor: '#166534', color: '#166534' }}
                  title="Resend Onboarding Email"
                  disabled={sendingPartnerEmail}
                  onClick={() => handleResendPartnerEmail([company._id])}>
                  <Send size={13} /> Resend Email
                </button>
                <div data-company-action-menu style={{ position: 'relative', display: 'inline-block', flex: 1 }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    style={{
                      width: '100%',
                      border: openCompanyMenu === `${company._id}-footer` ? '1.5px solid #166534' : '1px solid #d1d5db',
                      background: openCompanyMenu === `${company._id}-footer` ? '#f0fdf4' : '#fff',
                      color: openCompanyMenu === `${company._id}-footer` ? '#166534' : '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenCompanyMenu(prev => prev === `${company._id}-footer` ? null : `${company._id}-footer`);
                    }}
                  >
                    <MoreVertical size={14} /> Actions
                  </button>
                  {renderActionDropdown(company, `${company._id}-footer`, 'right', 'up')}
                </div>
              </div>
            </div>
          )})}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', minHeight: 480, paddingBottom: 220 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={companies.length > 0 && selectedCompanies.length === companies.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedCompanies(companies.map(c => c._id));
                      else setSelectedCompanies([]);
                    }}
                  />
                </th>
                <th>Partner Organisation</th>
                <th>Sector & Specialisation</th>
                <th>Contact & Email</th>
                <th>Interns</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(company => {
                const isSelected = selectedCompanies.includes(company._id);
                return (
                  <tr key={company._id} style={{ background: isSelected ? '#f0fdf4' : 'transparent' }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedCompanies(prev =>
                            prev.includes(company._id) ? prev.filter(id => id !== company._id) : [...prev, company._id]
                          );
                        }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#111827' }}>{company.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} /> {company.address || company.state}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{company.sector}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{company.specialisation || 'General IT'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{company.contactPerson || '—'}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{company.contactEmail || '—'}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#111827' }}>
                        {company.currentStudents || 0} / {company.maxStudents || 10}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        background: company.isApproved ? '#f0fdf4' : '#fef9c3',
                        color: company.isApproved ? '#166534' : '#854d0e',
                        border: `1px solid ${company.isApproved ? '#bbf7d0' : '#fde047'}`,
                        fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 100
                      }}>
                        {company.isApproved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div data-company-action-menu style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          aria-label={`Actions for ${company.name}`}
                          style={{
                            padding: '6px 8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 6,
                            border: openCompanyMenu === `${company._id}-table` ? '1.5px solid #166534' : '1px solid transparent',
                            background: openCompanyMenu === `${company._id}-table` ? '#f0fdf4' : 'transparent',
                            color: openCompanyMenu === `${company._id}-table` ? '#166534' : '#4b5563',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenCompanyMenu(prev => prev === `${company._id}-table` ? null : `${company._id}-table`);
                          }}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {renderActionDropdown(company, `${company._id}-table`, 'right', 'down')}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative',
            maxHeight: '90vh', overflowY: 'auto' }}>
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
              <button className="btn btn-outline btn-sm" style={{ flex: 1, borderColor: '#166534', color: '#166534' }}
                disabled={sendingPartnerEmail}
                onClick={() => {
                  handleResendPartnerEmail([showManageModal._id]);
                  setShowManageModal(null);
                }}>
                <Send size={14} /> Resend Email
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
        <BulkEnrollModal
          defaultType="company"
          allowedTypes={["company"]}
          onClose={() => setShowBulkEnroll(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
