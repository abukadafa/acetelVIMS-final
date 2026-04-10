import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import {
  History, Search, RefreshCw, Filter, Calendar,
  Download, ChevronDown, Shield, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AuditLog {
  _id: string;
  user?: { firstName: string; lastName: string; email: string };
  action: string;
  module: string;
  targetId?: string;
  reason?: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

/* ── Module colour map ── */
const MODULE_COLORS: Record<string, string> = {
  USER_MANAGEMENT:  'badge-amber',
  RECYCLE_BIN:      'badge-red',
  STUDENT_MANAGEMENT: 'badge-blue',
  LOGIN:            'badge-green',
  PROGRAMME:        'badge-primary',
};

/* ── Action severity map ── */
const ACTION_SEVERITY: Record<string, string> = {
  DELETE_USER:             'badge-red',
  PERMANENT_DELETE_USER:   'badge-red',
  PERMANENT_DELETE_STUDENT:'badge-red',
  PERMANENT_DELETE_COMPANY:'badge-red',
  RESTORE_USER:            'badge-green',
  RESTORE_STUDENT:         'badge-green',
  RESTORE_COMPANY:         'badge-green',
  CREATE_STUDENT:          'badge-blue',
  CREATE_USER:             'badge-blue',
  LOGIN:                   'badge-gray',
  LOGOUT:                  'badge-gray',
};

/* ═══════════════════════════════════════════════════════════════ */
export default function AuditTrailPage() {
  const [logs, setLogs]           = useState<AuditLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [moduleFilter, setModule] = useState('');
  const [actionFilter]            = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 500 };
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      const { data } = await api.get('/admin/audit-logs', { params });
      setLogs(data.logs);
    } catch {
      toast.error('Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, actionFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  /* ── Client-side filtering (search + date range) ── */
  const filteredLogs = logs.filter(l => {
    const matchSearch =
      !search ||
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      l.user?.email.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.user?.firstName.toLowerCase().includes(search.toLowerCase()) ||
      l.user?.lastName.toLowerCase().includes(search.toLowerCase());

    const logDate = new Date(l.createdAt);
    const matchFrom = !dateFrom || logDate >= new Date(dateFrom);
    const matchTo   = !dateTo   || logDate <= new Date(dateTo + 'T23:59:59');

    return matchSearch && matchFrom && matchTo;
  });

  /* ── Export ── */
  const exportCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Email', 'Module', 'Action', 'Details', 'Reason', 'IP Address'];
    const rows = filteredLogs.map(l => [
      new Date(l.createdAt).toISOString(),
      l.user ? `${l.user.firstName} ${l.user.lastName}` : 'System',
      l.user?.email || '',
      l.module,
      l.action,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      l.ipAddress || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ACETEL_AuditTrail_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredLogs.length} audit records as CSV`);
    setShowExportMenu(false);
  };

  const exportJSON = () => {
    const json = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ACETEL_AuditTrail_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredLogs.length} audit records as JSON`);
    setShowExportMenu(false);
  };

  const exportPrintView = () => {
    const printContent = `
      <html>
        <head>
          <title>ACETEL Audit Trail — ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: system-ui, sans-serif; font-size: 11px; color: #111; }
            h1 { margin-bottom: 4px; }
            .sub { color: #666; font-size: 10px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f3f4f6; text-align: left; padding: 6px 8px; border: 1px solid #e5e7eb; font-size: 10px; text-transform: uppercase; }
            td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
            tr:nth-child(even) { background: #f9fafb; }
          </style>
        </head>
        <body>
          <h1>ACETEL Institutional Audit Trail</h1>
          <div class="sub">Exported: ${new Date().toLocaleString()} · ${filteredLogs.length} records</div>
          <table>
            <thead><tr><th>Timestamp</th><th>Actor</th><th>Module</th><th>Action</th><th>Details</th><th>Reason</th><th>IP</th></tr></thead>
            <tbody>
              ${filteredLogs.map(l => `
                <tr>
                  <td>${new Date(l.createdAt).toLocaleString()}</td>
                  <td>${l.user ? `${l.user.firstName} ${l.user.lastName}<br/><small>${l.user.email}</small>` : 'System'}</td>
                  <td>${l.module}</td>
                  <td>${l.action}</td>
                  <td>${l.details || ''}</td>
                  <td>${l.reason || ''}</td>
                  <td>${l.ipAddress || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(printContent); w.document.close(); w.print(); }
    setShowExportMenu(false);
  };

  return (
    <div className="audit-trail animate-fade" onClick={() => setShowExportMenu(false)}>

      {/* ══ Page Header ══ */}
      <div className="page-hero">
        <div className="page-hero-left">
          <div className="page-hero-icon"><History size={24} /></div>
          <div>
            <h1 className="page-hero-title">Global Audit Trail</h1>
            <p className="page-hero-sub">
              Institutional oversight of all administrative and student data modifications
              {filteredLogs.length > 0 && (
                <span style={{ marginLeft: 8, fontWeight: 700, color: 'var(--primary)' }}>
                  — {filteredLogs.length} record{filteredLogs.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Export Button */}
          <div className="export-dropdown-wrap" onClick={e => e.stopPropagation()}>
            <button
              className="btn btn-primary"
              onClick={() => setShowExportMenu(m => !m)}
              disabled={filteredLogs.length === 0}
              id="export-audit-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <Download size={15} /> Export <ChevronDown size={13} />
            </button>
            {showExportMenu && (
              <div className="export-dropdown">
                <button className="export-option" onClick={exportCSV} id="export-csv-btn">
                  <FileText size={15} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Download as CSV</div>
                    <div style={{ fontSize: '.72rem', opacity: 0.7 }}>Compatible with Excel & Google Sheets</div>
                  </div>
                </button>
                <button className="export-option" onClick={exportJSON} id="export-json-btn">
                  <Shield size={15} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Download as JSON</div>
                    <div style={{ fontSize: '.72rem', opacity: 0.7 }}>Raw structured data format</div>
                  </div>
                </button>
                <button className="export-option" onClick={exportPrintView} id="export-print-btn">
                  <FileText size={15} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Print / Save as PDF</div>
                    <div style={{ fontSize: '.72rem', opacity: 0.7 }}>Opens browser print dialog</div>
                  </div>
                </button>
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={loadLogs} title="Refresh" id="refresh-audit-btn">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* ══ Filters ══ */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 2, minWidth: '280px' }}>
            <Search size={16} className="search-icon" />
            <input
              className="form-control"
              placeholder="Search by user, action, or details..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              id="audit-search"
            />
          </div>
          <div className="select-wrap" style={{ flex: 1, minWidth: 180 }}>
            <Filter size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            <select
              className="form-control form-select"
              style={{ paddingLeft: 34 }}
              value={moduleFilter}
              onChange={e => setModule(e.target.value)}
              id="module-filter"
            >
              <option value="">All Modules</option>
              <option value="USER_MANAGEMENT">User Management</option>
              <option value="STUDENT_MANAGEMENT">Student Management</option>
              <option value="RECYCLE_BIN">Recycle Bin</option>
              <option value="LOGIN">Auth / Portal Access</option>
              <option value="PROGRAMME">Academic Setup</option>
            </select>
          </div>
          {/* Date Range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
            <input
              type="date"
              className="form-control"
              style={{ width: 140 }}
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              id="date-from"
              title="From date"
            />
            <span style={{ opacity: 0.5, fontSize: '.8rem' }}>–</span>
            <input
              type="date"
              className="form-control"
              style={{ width: 140 }}
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              id="date-to"
              title="To date"
            />
            {(dateFrom || dateTo) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                title="Clear date filter"
              >✕</button>
            )}
          </div>
        </div>
      </div>

      {/* ══ Stats Strip ══ */}
      {!loading && filteredLogs.length > 0 && (
        <div className="audit-stats-strip">
          {[
            { label: 'All Events',     count: filteredLogs.length,                           color: 'var(--text-1)' },
            { label: 'Deletions',      count: filteredLogs.filter(l => l.action.includes('DELETE')).length, color: '#ef4444' },
            { label: 'Restorations',   count: filteredLogs.filter(l => l.action.includes('RESTORE')).length, color: '#10b981' },
            { label: 'Creations',      count: filteredLogs.filter(l => l.action.includes('CREATE')).length,  color: '#6366f1' },
          ].map(({ label, count, color }) => (
            <div key={label} className="audit-stat-item">
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{count}</span>
              <span style={{ fontSize: '.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ══ Log Table ══ */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="page-loader"><div className="spinner spinner-lg" /></div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><History size={40} /></div>
            <div className="empty-title">No audit records found</div>
            <div className="empty-desc">System actions matching your filters will appear here.</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Timestamp</th>
                  <th>Actor</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Details / Reason</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log._id}>
                    <td style={{ fontSize: '.75rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={12} />
                        {new Date(log.createdAt).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td>
                      {log.user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="sidebar-avatar" style={{ width: 26, height: 26, fontSize: '.6rem', flexShrink: 0 }}>
                            {log.user.firstName[0]}{log.user.lastName[0]}
                          </div>
                          <div style={{ fontSize: '.8rem' }}>
                            <strong>{log.user.firstName} {log.user.lastName}</strong>
                            <div style={{ opacity: 0.6, fontSize: '.65rem' }}>{log.user.email}</div>
                          </div>
                        </div>
                      ) : <span style={{ color: 'var(--text-3)', fontSize: '.8rem' }}>System</span>}
                    </td>
                    <td>
                      <span className={`badge ${MODULE_COLORS[log.module] || 'badge-gray'}`} style={{ fontSize: '.65rem' }}>
                        {log.module}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${ACTION_SEVERITY[log.action] || 'badge-primary'}`} style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 500, lineHeight: 1.4 }}>{log.details}</div>
                      {log.reason && (
                        <div style={{ fontSize: '.7rem', color: 'var(--danger)', marginTop: 3, display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                          <span style={{ opacity: 0.6, flexShrink: 0 }}>Reason:</span>
                          <span style={{ fontStyle: 'italic' }}>{log.reason}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '.7rem', fontFamily: 'monospace', color: 'var(--text-3)' }}>
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Styles ══ */}
      <style>{`
        .export-dropdown-wrap {
          position: relative;
        }
        .export-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--surface-1);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          min-width: 260px;
          z-index: 100;
          overflow: hidden;
          animation: fadeIn 0.15s ease;
        }
        .export-option {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          width: 100%;
          padding: 14px 16px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          color: var(--text-1);
          font-size: .85rem;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }
        .export-option:last-child { border-bottom: none; }
        .export-option:hover { background: var(--surface-2); }
        .export-option svg { color: var(--primary); flex-shrink: 0; margin-top: 2px; }

        .audit-stats-strip {
          display: flex;
          gap: 2px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .audit-stat-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 14px 8px;
          gap: 3px;
          border-right: 1px solid var(--border);
        }
        .audit-stat-item:last-child { border-right: none; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
