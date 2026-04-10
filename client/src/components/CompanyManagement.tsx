import { useState, useEffect } from 'react';
import { Building2, Search, MapPin, Users, Plus, Star, MoreHorizontal, ExternalLink, Upload } from 'lucide-react';
import api from '../lib/api';
import { toast } from 'react-hot-toast';
import BulkEnrollModal from './BulkEnrollModal';

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showBulkEnroll, setShowBulkEnroll] = useState(false);

  useEffect(() => {
    fetchData();
  }, [search]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/companies', { params: { search } });
      setCompanies(data.companies);
    } catch (err) {
      toast.error('Failed to load company partners');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card animate-fade-in">
      <div className="card-header" style={{ marginBottom: '24px' }}>
        <h3 className="card-title"><Building2 size={20} /> ACETEL Industry Internship Placement Partners</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowBulkEnroll(true)}>
            <Upload size={16} /> Bulk Import Partners
          </button>
          <button className="btn btn-primary btn-sm"><Plus size={16} /> Partner Register</button>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div className="search-bar">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search by company name, industry, or state..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid-2" style={{ gap: '20px' }}>
        {loading ? (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '40px' }}><div className="spinner spinner-lg" /></div>
        ) : companies.length === 0 ? (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>No partner organizations registered yet.</div>
        ) : (
          companies.map(company => (
            <div key={company._id} className="card" style={{ border: '1px solid var(--border-2)', background: 'var(--bg-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="avatar avatar-square" style={{ width: '48px', height: '48px', borderRadius: '8px' }}>
                    {company.logo ? <img src={company.logo} alt={company.name} /> : <Building2 size={24} />}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 700 }}>{company.name}</h4>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                       <MapPin size={12} /> {company.address || company.state}
                    </div>
                  </div>
                </div>
                <button className="btn btn-sm btn-ghost"><MoreHorizontal size={14} /></button>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                   <span style={{ color: 'var(--text-3)' }}>Area of Specialisation:</span>
                   <span style={{ fontWeight: 600 }}>{company.specialisation || company.sector || 'General IT'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                   <span style={{ color: 'var(--text-3)' }}>Headcount:</span>
                   <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={14} /> {company.studentCount || 0} Students</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                   <span style={{ color: 'var(--text-3)' }}>Performance:</span>
                   <span style={{ color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '2px' }}><Star size={14} fill="currentColor" /> 4.8</span>
                </div>
              </div>

              <div className="divider" style={{ margin: '16px 0' }}></div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-sm btn-ghost" style={{ flex: 1 }}><ExternalLink size={14} /> Website</button>
                <button className="btn btn-sm btn-primary" style={{ flex: 1 }}>Manage Allocation</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
         <button className="btn btn-ghost">ACETEL Industry Internship Placement Partners</button>
      </div>

      {showBulkEnroll && (
        <BulkEnrollModal 
          onClose={() => setShowBulkEnroll(false)}
          onSuccess={() => fetchData()}
        />
      )}
    </div>
  );
}
