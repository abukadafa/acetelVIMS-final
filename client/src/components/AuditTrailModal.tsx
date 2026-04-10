import { useEffect, useState } from 'react';
import api from '../lib/api';
import { X, History, Filter, Download, Terminal } from 'lucide-react';
import toast from 'react-hot-toast';

interface AuditLog {
  _id: string;
  user: { firstName: string; lastName: string; email: string };
  action: string;
  module: string;
  details: string;
  targetId?: string;
  reason?: string;
  ipAddress?: string;
  createdAt: string;
}

interface AuditTrailModalProps {
  targetId?: string;
  title?: string;
  onClose: () => void;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE_USER: 'badge-green',
  UPDATE_USER: 'badge-blue',
  DELETE_USER: 'badge-red',
  RESTORE_USER: 'badge-amber',
  LOGIN_SUCCESS: 'badge-green',
  LOGIN_FAILED: 'badge-red',
  LOGOUT: 'badge-gray',
  PASSWORD_CHANGED: 'badge-blue',
};

export default function AuditTrailModal({ targetId, title = 'System Audit Trail', onClose }: AuditTrailModalProps) {
  const [logs, setLogs]             = useState<AuditLog[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/admin/audit-logs', { params: { targetId, action: filterAction } })
      .then(r => setLogs(r.data.logs))
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, [targetId, filterAction]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-scale-in" style={{ maxWidth: 860, width: '90%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="page-hero-icon" style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)' }}>
              <History size={20} />
            </div>
            <div>
              <h2 className="modal-title">{title}</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Institutional oversight of authentication and administrative actions</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm btn-outline" onClick={() => window.print()}>Print Report</button>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {/* Toolbar */}
          <div style={{ padding: '16px 24px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Filter size={14} style={{ color: 'var(--text-3)' }} />
              <select 
                className="form-control form-select btn-sm" 
                style={{ width: 'auto', padding: '4px 32px 4px 12px' }}
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
              >
                <option value="">All Actions</option>
                <optgroup label="Account Management">
                  <option value="CREATE_USER">Create User</option>
                  <option value="UPDATE_USER">Update User</option>
                  <option value="DELETE_USER">Delete User</option>
                  <option value="RESTORE_USER">Restore User</option>
                </optgroup>
                <optgroup label="Authentication / Security">
                  <option value="LOGIN_SUCCESS">Successful login</option>
                  <option value="LOGIN_FAILED">Failed Login</option>
                  <option value="LOGOUT">Logout</option>
                  <option value="PASSWORD_CHANGED">Password Change</option>
                </optgroup>
              </select>
            </div>
            <button className="btn btn-sm btn-outline"><Download size={14} /> Export CSV</button>
          </div>

          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {loading ? (
              <div className="page-loader"><div className="spinner" /></div>
            ) : logs.length === 0 ? (
              <div className="empty-state">
                <Terminal size={32} className="empty-icon" />
                <div className="empty-desc">No audit logs found for this criteria.</div>
              </div>
            ) : (
              <div className="table-container" style={{ boxShadow: 'none' }}>
                <table style={{ border: 'none' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th>Timestamp</th>
                      <th>Performer</th>
                      <th>Action</th>
                      <th>Device / IP</th>
                      <th>Context / Justification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log._id}>
                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <div className="avatar avatar-sm" style={{ width: 24, height: 24, fontSize: '0.65rem' }}>
                               {log.user.firstName[0]}{log.user.lastName[0]}
                             </div>
                             <div style={{ fontSize: '0.85rem' }}>{log.user.firstName} {log.user.lastName}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${ACTION_COLORS[log.action] || 'badge-gray'}`} style={{ fontSize: '0.65rem', fontWeight: 700 }}>
                            {log.action.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>
                          {log.ipAddress || 'Internal'}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                            {log.details}
                          </div>
                          {log.reason && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '4px', fontStyle: 'italic' }}>
                               Reason: "{log.reason}"
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button className="btn btn-primary" onClick={onClose}>Close History</button>
        </div>
      </div>
    </div>
  );
}
