import React, { useState } from 'react';
import { 
  X, Upload, Download, CheckCircle, 
  Building2, Users, GraduationCap, ArrowRight, ShieldCheck, 
  Copy, Check
} from 'lucide-react';
import Papa from 'papaparse';
import api from '../lib/api';
import toast from 'react-hot-toast';

type OnboardType = 'staff' | 'student' | 'company';

interface BulkEnrollModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: OnboardType;
  /** If provided, only these entity types are shown in step 1. */
  allowedTypes?: OnboardType[];
}

export default function BulkEnrollModal({ onClose, onSuccess, defaultType = 'student', allowedTypes }: BulkEnrollModalProps) {
  const singleType = allowedTypes?.length === 1;
  const [step, setStep] = useState(singleType ? 2 : 1);
  // When only one type is allowed, always use it regardless of defaultType prop
  const [type, setType] = useState<OnboardType>(singleType ? allowedTypes![0] : defaultType);
  const [fileData, setFileData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ success: any[], failed: any[] } | null>(null);
  const [copied, setCopied] = useState(false);

  /* ── Template Download ── */
  const downloadTemplate = () => {
    let headers = '';
    let filename = '';
    
    if (type === 'staff') {
      headers = 'Surname,Other Names,Institutional Email,Phone Number,role,programmeCode\nDoe,John,john@acetel.edu.ng,08012345678,supervisor,MSC-AI';
      filename = 'acetel_staff_template.csv';
    } else if (type === 'student') {
      headers = 'Surname,Other Names,Matric Number,Institutional Email,Personal Email,Gender,Phone Number,Nigerianity,Address,programmeCode,academicSession,level\nStudent,Jane,ACE/23/MSC/001,jane@student.acetel.edu.ng,jane.personal@gmail.com,Female,08098765432,Nigerian,No 10 University Way,MSC-CS,2024/2025,MSC';
      filename = 'acetel_student_template.csv';
    } else {
      headers = 'Company Name,Company Address,Area of Specialisation,State\nGlo Nigeria,Plot 1 Adeola Odeku VI,Telecommunications,Lagos\nAccess Bank,999 Corporate Square,Banking & Finance,Lagos';
      filename = 'acetel_partner_template.csv';
    }

    const blob = new Blob([headers], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  /* ── File Parsing ── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const csvText = evt.target?.result as string;
        // transformHeader strips a UTF-8 BOM (common when saving CSVs from Excel)
        // and trims stray whitespace so 'Matric Number ' still matches the
        // exact key the backend/preview expect — without this, files edited in
        // Excel silently produced rows the backend rejected as "missing fields".
        const result = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
          transform: (v) => (typeof v === 'string' ? v.trim() : v),
        });
        const data = (result.data as any[]).filter((row) =>
          Object.values(row).some((v) => String(v ?? '').trim() !== '')
        );

        if (!data || data.length === 0) {
          toast.error('The uploaded file is empty or has no readable rows. Please use the provided CSV template.');
          return;
        }

        setFileData(data);
        setStep(3); // Move to preview
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse file. Please use the provided CSV template.');
      }
    };
    reader.readAsText(file);
  };

  /* ── Submit ── */
  const performUpload = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/admin/bulk-onboard', { type, data: fileData });
      setResults(data);
      setStep(4); // Move to results
      if (data.success.length === 0) {
        toast.error(`No ${type} records were created — check the failure reasons below.`);
      } else if (data.failed.length > 0) {
        toast(`${data.success.length} onboarded, ${data.failed.length} failed. See details below.`, { icon: '⚠️' });
      }
      if (type !== 'company' && data.success.length > 0) {
        if (!data.emailConfigured) toast.error('Email is not configured on backend (SMTP_USER/SMTP_PASS missing) — accounts were created but no welcome email was sent.');
        if (!data.whatsappConfigured) toast('WhatsApp is not configured on backend — accounts were created but no WhatsApp message was sent.', { icon: 'ℹ️' });
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Bulk enrollment failed');
    } finally {
      setLoading(false);
    }
  };

  /* ── Copy Results ── */
  const copyCreds = () => {
    if (!results) return;
    const text = results.success.map(s => 
      type === 'company' 
        ? `Partner: ${s.name}\nRegistered ID: ${s.id}\n-------------------`
        : `Name: ${s.name}\nEmail: ${s.email}\nUsername: ${s.username}\nTemp Password: ${s.tempPassword}\n-------------------`
    ).join('\n');
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Onboarding report copied to clipboard');
  };

  /* ── Robust Row Data Extraction for Preview & Diagnostics ── */
  const getRowValue = (row: any, ...keys: string[]) => {
    if (!row || typeof row !== 'object') return '';
    const normalizedKeyMap: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKeyMap[cleanKey] === undefined && v !== undefined && v !== null && String(v).trim() !== '') {
        normalizedKeyMap[cleanKey] = v;
      }
    }
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return String(row[key]).trim();
      }
      const cleanLookup = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKeyMap[cleanLookup] !== undefined) {
        return String(normalizedKeyMap[cleanLookup]).trim();
      }
    }
    return '';
  };

  const getCandidateName = (row: any) => {
    const first = getRowValue(row, 'Other Names', 'First Name', 'firstname', 'givenname');
    const last = getRowValue(row, 'Surname', 'Last Name', 'lastname', 'familyname');
    if (first || last) return `${first} ${last}`.trim();
    return getRowValue(row, 'Name', 'Full Name', 'Candidate Name', 'Student Name') || '—';
  };

  const getCandidateIdentity = (row: any) => {
    const email = getRowValue(row, 'Institutional Email', 'Personal Email', 'Email', 'Student Email', 'Email Address');
    const matric = getRowValue(row, 'Matric Number', 'Matric No', 'Reg No', 'Registration Number', 'Student ID', 'ID');
    if (email && matric) return `${email} (${matric})`;
    return email || matric || '—';
  };

  const getCandidateRoleProg = (row: any, entityType: OnboardType) => {
    if (entityType === 'student') {
      return getRowValue(row, 'programmeCode', 'Programme Code', 'Programme', 'Course', 'Department', 'Specialisation') || '—';
    }
    return getRowValue(row, 'role', 'Designation', 'Position', 'Department') || 'supervisor';
  };

  const getCompanyValue = (row: any, field: 'name' | 'address' | 'spec' | 'state') => {
    if (field === 'name') return getRowValue(row, 'Company Name', 'Organization Name', 'Name', 'Partner Name', 'Institution') || '—';
    if (field === 'address') return getRowValue(row, 'Company Address', 'Address', 'Location', 'Office Address') || '—';
    if (field === 'spec') return getRowValue(row, 'Area of Specialisation', 'Specialisation', 'Specialization', 'Sector', 'Industry', 'Field') || '—';
    if (field === 'state') return getRowValue(row, 'State', 'State of Origin', 'State of Residence', 'Region', 'Location State') || '—';
    return '—';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        
        <div className="modal-header" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {type === 'company' ? <Building2 size={22} className="text-primary" /> : <Upload size={20} className="text-primary" />} 
              Institutional Bulk {type === 'company' ? 'Partner Onboarding' : 'Enrollment'}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
              {singleType
                ? `Step ${step - 1} of 3: ${step === 2 ? 'Upload Data' : step === 3 ? 'Review' : 'Final Report'}`
                : `Step ${step} of 4: ${step === 1 ? 'Choose Entity' : step === 2 ? 'Upload Data' : step === 3 ? 'Review' : 'Final Report'}`}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ minHeight: 400 }}>
          
          {step === 1 && (
            <div className="animate-fade onboarding-type-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, padding: '20px 0' }}>
              {(!allowedTypes || allowedTypes.includes('student')) && (
                <button 
                  className={`card onboarding-card ${type === 'student' ? 'active' : ''}`}
                  onClick={() => setType('student')}
                  style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: type === 'student' ? '2px solid var(--primary)' : '1px solid var(--border)' }}
                >
                  <div className="badge-icon" style={{ margin: '0 auto 12px', background: type === 'student' ? 'var(--primary-light)' : 'var(--surface-3)' }}>
                    <GraduationCap size={24} />
                  </div>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: 4 }}>Student Cohort</h3>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Onboard Academic Intake Batches</p>
                </button>
              )}

              {(!allowedTypes || allowedTypes.includes('staff')) && (
                <button 
                  className={`card onboarding-card ${type === 'staff' ? 'active' : ''}`}
                  onClick={() => setType('staff')}
                  style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: type === 'staff' ? '2px solid var(--primary)' : '1px solid var(--border)' }}
                >
                  <div className="badge-icon" style={{ margin: '0 auto 12px', background: type === 'staff' ? 'var(--primary-light)' : 'var(--surface-3)' }}>
                    <Users size={24} />
                  </div>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: 4 }}>Institutional Staff</h3>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Enroll Faculty & Supervisors</p>
                </button>
              )}

              {(!allowedTypes || allowedTypes.includes('company')) && (
                <button 
                  className={`card onboarding-card ${type === 'company' ? 'active' : ''}`}
                  onClick={() => setType('company')}
                  style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: type === 'company' ? '2px solid var(--primary)' : '1px solid var(--border)' }}
                >
                  <div className="badge-icon" style={{ margin: '0 auto 12px', background: type === 'company' ? 'var(--primary-light)' : 'var(--surface-3)' }}>
                    <Building2 size={24} />
                  </div>
                  <h3 style={{ fontSize: '0.9rem', marginBottom: 4 }}>Industry Partners</h3>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Mass-Onboard Companies</p>
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade" style={{ padding: '10px 0' }}>
              <div className="alert alert-info" style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} /> Data Consistency Note
                </div>
                Please use the official {type.toUpperCase()} template or any standard CSV. Headers are flexible (e.g. First Name, Last Name, Matric No, Email, Programme).
                {type === 'company' ? ' Required: Company Name, Company Address.' : ' Required: Email/Matric Number, Candidate Name.'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <button className="btn btn-outline" onClick={downloadTemplate} style={{ width: '100%', padding: '16px', justifyContent: 'center' }}>
                  <Download size={18} /> Download {type.toUpperCase()} CSV Template
                </button>

                <div className="upload-zone" style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '40px 20px', textAlign: 'center', background: 'var(--surface-1)', position: 'relative' }}>
                  <Upload size={32} className="text-primary" style={{ marginBottom: 12, opacity: 0.5 }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Click or Drag File Here</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Supports .csv only</p>
                  <input type="file" accept=".csv" onChange={handleFileUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.9rem' }}>Preview {type} List ({fileData.length} entries)</h3>
                <button className="btn btn-xs btn-ghost" onClick={() => setStep(2)}>Upload New File</button>
              </div>

              <div className="table-container" style={{ maxHeight: 300, border: '1px solid var(--border)', borderRadius: 8 }}>
                <table style={{ fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      {type === 'company' ? (
                        <>
                          <th>Company Name</th>
                          <th>Address</th>
                          <th>Specialisation</th>
                          <th>State</th>
                        </>
                      ) : (
                        <>
                          <th>Candidate Name</th>
                          <th>Identity (Email/Matric)</th>
                          <th>Role/Programme</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {type === 'company' ? (
                          <>
                            <td>{getCompanyValue(row, 'name')}</td>
                            <td>{getCompanyValue(row, 'address')}</td>
                            <td>{getCompanyValue(row, 'spec')}</td>
                            <td>{getCompanyValue(row, 'state')}</td>
                          </>
                        ) : (
                          <>
                            <td>{getCandidateName(row)}</td>
                            <td>{getCandidateIdentity(row)}</td>
                            <td>{getCandidateRoleProg(row, type)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 4 && results && (
            <div className="animate-fade">
              <div style={{ textAlign: 'center', padding: '10px 0 24px' }}>
                <div className={`badge-icon ${results.success.length > 0 ? 'success' : 'warning'}`} style={{ margin: '0 auto 12px', width: 56, height: 56 }}>
                  {results.success.length > 0 ? <CheckCircle size={32} /> : <ShieldCheck size={32} />}
                </div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: 4 }}>
                  {results.success.length > 0 ? 'Institutional Onboarding Complete!' : 'No Records Were Created'}
                </h2>
                <p style={{ color: 'var(--text-3)' }}>
                  <strong>{results.success.length}</strong> of <strong>{results.success.length + results.failed.length}</strong> {type} records were onboarded successfully.
                  {results.failed.length > 0 && <> <strong style={{ color: 'var(--danger, #dc2626)' }}>{results.failed.length}</strong> failed — see reasons below.</>}
                </p>
              </div>

              {results.failed.length > 0 && (
                <div className="card" style={{ padding: 16, marginBottom: 16, background: '#fff5f5', border: '1px solid #feb2b2' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8, color: '#c53030' }}>
                    Rows that failed ({results.failed.length})
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: '0.75rem' }}>
                    {results.failed.map((f, i) => {
                      const rowId = f.row ? (getCandidateIdentity(f.row) !== '—' ? getCandidateIdentity(f.row) : getCandidateName(f.row)) : '';
                      const identifier = f.email || f.name || (rowId !== '—' ? rowId : '') || `Row ${i + 1}`;
                      return (
                        <div key={i} style={{ borderBottom: '1px solid #feb2b2', padding: '6px 0' }}>
                          <strong>{identifier}</strong>
                          {' — '}{f.reason}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {results.success.length > 0 && (
                <div className="card" style={{ padding: 16, background: 'var(--surface-2)', border: '1px solid var(--primary-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Onboarding Report</div>
                    <button className="btn btn-sm btn-outline" onClick={copyCreds}>
                      {copied ? <Check size={14} /> : <Copy size={14} />} Copy Summary
                    </button>
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: '0.75rem' }}>
                    {results.success.map((s, i) => (
                      <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{s.name}</span>
                        {type !== 'company' && <code style={{ color: 'var(--primary)', fontWeight: 700 }}>{s.tempPassword}</code>}
                        {type === 'company' && <span style={{ color: 'var(--success)', fontWeight: 600 }}>Active</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '16px 24px' }}>
          {step < 4 ? (
            <>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <div style={{ flex: 1 }} />
              {step > 1 && !singleType && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
              {step > 2 && singleType && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
              {step === 1 && <button className="btn btn-primary" onClick={() => setStep(2)}>Set Enrollment Path <ArrowRight size={16} /></button>}
              {step === 3 && <button className="btn btn-primary" onClick={performUpload} disabled={loading}>{loading ? 'Onboarding...' : 'Execute Batch Upload'}</button>}
            </>
          ) : (
            <button className="btn btn-primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>Finish & Sync</button>
          )}
        </div>
      </div>
      <style>{`
        .onboarding-card { transition: all 0.2s; }
        .onboarding-card:hover { transform: translateY(-4px); border-color: var(--primary) !important; }
        .onboarding-card.active { background: var(--primary-light); border-color: var(--primary) !important; }
        .badge-icon.success { background: #f0fff4; color: #38a169; }
        .badge-icon.warning { background: #fffaf0; color: #dd6b20; }
        @media (max-width: 560px) {
          .onboarding-type-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
