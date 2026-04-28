import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Shield, Ban, CheckCircle, AlertTriangle, RefreshCw, Eye, Lock, Unlock, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Navigate } from 'react-router-dom';

interface BlockedIP { _id: string; ip: string; reason: string; requestCount: number; blockedAt: string; blockedUntil?: string; isActive: boolean; autoBlocked: boolean; unblockedBy?: { firstName: string; lastName: string }; }
interface Suspect { ip: string; suspicionScore: number; windows: { '1m': number; '5m': number; '15m': number; '1h': number }; failedLogins: number; last404s: number; lastSeen: string; isBlocked: boolean; }
interface Stats { totalBlocked: number; activeBlocked: number; autoBlocked: number; manualBlocked: number; highSuspicion: number; recentBlocks: BlockedIP[]; }

export default function FirewallPage() {
  const { isRole } = useAuth();
  const [tab, setTab] = useState<'dashboard' | 'blocked' | 'suspects'>('dashboard');
  const [stats, setStats]     = useState<Stats | null>(null);
  const [blocked, setBlocked] = useState<BlockedIP[]>([]);
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [blockForm, setBlockForm] = useState({ ip: '', reason: '', durationHours: '24' });
  const [unblockForm, setUnblockForm] = useState({ ip: '', reason: '' });
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showUnblockModal, setShowUnblockModal] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b, sp] = await Promise.all([
        api.get('/firewall/stats'),
        api.get(`/firewall/blocked?status=${statusFilter}`),
        api.get('/firewall/suspects'),
      ]);
      setStats(s.data);
      setBlocked(b.data.blocked);
      setSuspects(sp.data.suspects);
    } catch { toast.error('Failed to load firewall data'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!isRole('admin')) return <Navigate to="/" replace />;

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/firewall/block', {
        ip: blockForm.ip,
        reason: blockForm.reason,
        durationHours: blockForm.durationHours === '0' ? undefined : parseInt(blockForm.durationHours),
      });
      toast.success(`IP ${blockForm.ip} blocked`);
      setShowBlockModal(false);
      setBlockForm({ ip: '', reason: '', durationHours: '24' });
      fetchAll();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Block failed'); }
  };

  const handleUnblock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.delete(`/firewall/block/${unblockForm.ip}`, { data: { reason: unblockForm.reason } });
      toast.success(`IP ${unblockForm.ip} unblocked`);
      setShowUnblockModal(false);
      setUnblockForm({ ip: '', reason: '' });
      fetchAll();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Unblock failed'); }
  };

  const quickBlock = (ip: string) => { setBlockForm(f => ({ ...f, ip })); setShowBlockModal(true); };
  const quickUnblock = (ip: string) => { setUnblockForm(f => ({ ...f, ip })); setShowUnblockModal(true); };

  const scoreColor = (score: number) => score >= 100 ? '#dc2626' : score >= 50 ? '#f97316' : '#f59e0b';
  const scoreBg    = (score: number) => score >= 100 ? '#fee2e2' : score >= 50 ? '#ffedd5' : '#fef3c7';

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={24} style={{ color: 'var(--primary)' }} /> Firewall & IP Security
          </h1>
          <p className="page-subtitle">Real-time threat detection, automatic IP blocking and manual controls</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline" onClick={fetchAll} disabled={loading}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          <button className="btn btn-primary" style={{ background: '#dc2626', border: 'none' }} onClick={() => setShowBlockModal(true)}>
            <Ban size={14} /> Block IP
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {[['dashboard','Dashboard'],['blocked','Blocked IPs'],['suspects','Suspicious IPs']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className="btn btn-ghost"
            style={{ borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent', borderRadius: '8px 8px 0 0', fontWeight: tab === key ? 700 : 400, color: tab === key ? 'var(--primary)' : 'var(--text-3)', marginBottom: '-2px' }}>
            {label}
            {key === 'blocked' && stats && <span style={{ marginLeft: '6px', background: '#dc2626', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '11px' }}>{stats.activeBlocked}</span>}
            {key === 'suspects' && stats && stats.highSuspicion > 0 && <span style={{ marginLeft: '6px', background: '#f97316', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '11px' }}>{stats.highSuspicion}</span>}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ── */}
      {tab === 'dashboard' && stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Active Blocks', value: stats.activeBlocked, color: '#dc2626', icon: Ban },
              { label: 'Auto-Blocked', value: stats.autoBlocked, color: '#f97316', icon: Shield },
              { label: 'Manual Blocks', value: stats.manualBlocked, color: '#7c3aed', icon: Lock },
              { label: 'High Suspicion', value: stats.highSuspicion, color: '#d97706', icon: AlertTriangle },
              { label: 'Total Ever Blocked', value: stats.totalBlocked, color: '#6b7280', icon: Activity },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <s.icon size={20} style={{ color: s.color }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '22px', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>🚫 Recent Auto-Blocks</h3>
            {stats.recentBlocks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>
                <CheckCircle size={32} style={{ opacity: 0.2, marginBottom: '8px' }} />
                <p style={{ fontSize: '13px' }}>No blocks yet — system is clean</p>
              </div>
            ) : stats.recentBlocks.map(b => (
              <div key={b._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <code style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '6px', fontSize: '13px', fontWeight: 700 }}>{b.ip}</code>
                <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-3)' }}>{b.reason}</span>
                <span style={{ fontSize: '11px', background: b.autoBlocked ? '#fff7ed' : '#f3e8ff', color: b.autoBlocked ? '#c2410c' : '#7c3aed', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                  {b.autoBlocked ? '🤖 Auto' : '👤 Manual'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{new Date(b.blockedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── BLOCKED IPs TAB ── */}
      {tab === 'blocked' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select className="form-input" style={{ width: 'auto', fontSize: '13px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="active">Active Blocks</option>
              <option value="expired">Expired / Unblocked</option>
              <option value="all">All</option>
            </select>
            <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{blocked.length} records</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['IP Address','Reason','Type','Blocked At','Expires','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-3)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {blocked.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>No blocked IPs found</td></tr>
                ) : blocked.map(b => (
                  <tr key={b._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}><code style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>{b.ip}</code></td>
                    <td style={{ padding: '12px 16px', maxWidth: '250px', color: 'var(--text-2)' }}>{b.reason}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: b.autoBlocked ? '#fff7ed' : '#f3e8ff', color: b.autoBlocked ? '#c2410c' : '#7c3aed', padding: '2px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                        {b.autoBlocked ? '🤖 Auto' : '👤 Manual'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-3)' }}>{new Date(b.blockedAt).toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-3)' }}>{b.blockedUntil ? new Date(b.blockedUntil).toLocaleString() : '♾️ Permanent'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {b.isActive && (
                        <button className="btn btn-sm btn-outline" style={{ color: '#16a34a', borderColor: '#16a34a', fontSize: '12px' }} onClick={() => quickUnblock(b.ip)}>
                          <Unlock size={12} /> Unblock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUSPECTS TAB ── */}
      {tab === 'suspects' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-3)' }}>
            IPs with elevated suspicion scores — auto-blocked at score ≥ 100. Updated every 5 minutes by the cron job.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Score','IP','1m Reqs','5m Reqs','1h Reqs','Failed Logins','Scanner Hits','Last Seen','Status','Action'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-3)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suspects.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>
                    <CheckCircle size={28} style={{ opacity: 0.2, display: 'block', margin: '0 auto 8px' }} />No suspicious IPs detected
                  </td></tr>
                ) : suspects.map(s => (
                  <tr key={s.ip} style={{ borderBottom: '1px solid var(--border)', background: s.suspicionScore >= 100 ? '#fff5f5' : '' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: scoreBg(s.suspicionScore), color: scoreColor(s.suspicionScore), padding: '3px 10px', borderRadius: '12px', fontWeight: 800, fontSize: '13px' }}>{s.suspicionScore}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}><code style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{s.ip}</code></td>
                    <td style={{ padding: '10px 12px', color: s.windows['1m'] > 100 ? '#dc2626' : 'var(--text-2)', fontWeight: s.windows['1m'] > 100 ? 700 : 400 }}>{s.windows['1m']}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>{s.windows['5m']}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>{s.windows['1h']}</td>
                    <td style={{ padding: '10px 12px', color: s.failedLogins > 5 ? '#dc2626' : 'var(--text-2)', fontWeight: s.failedLogins > 5 ? 700 : 400 }}>{s.failedLogins}</td>
                    <td style={{ padding: '10px 12px', color: s.last404s > 10 ? '#f97316' : 'var(--text-2)' }}>{s.last404s}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-3)', fontSize: '11px' }}>{new Date(s.lastSeen).toLocaleTimeString()}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: s.isBlocked ? '#fee2e2' : '#f0fdf4', color: s.isBlocked ? '#dc2626' : '#16a34a', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                        {s.isBlocked ? '🚫 Blocked' : '👁️ Watching'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {!s.isBlocked ? (
                        <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', border: 'none', fontSize: '11px' }} onClick={() => quickBlock(s.ip)}>
                          <Ban size={11} /> Block
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-outline" style={{ color: '#16a34a', borderColor: '#16a34a', fontSize: '11px' }} onClick={() => quickUnblock(s.ip)}>
                          <Unlock size={11} /> Unblock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && (
        <div className="modal-overlay">
          <div className="modal-card animate-slide-up" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#dc2626' }}>🚫 Block IP Address</h2>
              <button className="btn btn-ghost" onClick={() => setShowBlockModal(false)}>×</button>
            </div>
            <form onSubmit={handleBlock} style={{ padding: '24px' }}>
              <div className="form-group">
                <label className="form-label">IP Address *</label>
                <input className="form-input" placeholder="e.g. 192.168.1.100" value={blockForm.ip} onChange={e => setBlockForm(f => ({ ...f, ip: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea className="form-input" style={{ minHeight: '80px' }} placeholder="Why is this IP being blocked?" value={blockForm.reason} onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <select className="form-input" value={blockForm.durationHours} onChange={e => setBlockForm(f => ({ ...f, durationHours: e.target.value }))}>
                  <option value="1">1 hour</option>
                  <option value="6">6 hours</option>
                  <option value="24">24 hours</option>
                  <option value="168">1 week</option>
                  <option value="720">30 days</option>
                  <option value="0">Permanent</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowBlockModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#dc2626', border: 'none' }}><Ban size={14} /> Block IP</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unblock Modal */}
      {showUnblockModal && (
        <div className="modal-overlay">
          <div className="modal-card animate-slide-up" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#16a34a' }}>🔓 Unblock IP Address</h2>
              <button className="btn btn-ghost" onClick={() => setShowUnblockModal(false)}>×</button>
            </div>
            <form onSubmit={handleUnblock} style={{ padding: '24px' }}>
              <div className="form-group">
                <label className="form-label">IP Address</label>
                <input className="form-input" value={unblockForm.ip} onChange={e => setUnblockForm(f => ({ ...f, ip: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Reason for unblocking *</label>
                <textarea className="form-input" style={{ minHeight: '80px' }} placeholder="Why is this IP being unblocked?" value={unblockForm.reason} onChange={e => setUnblockForm(f => ({ ...f, reason: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowUnblockModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Unlock size={14} /> Confirm Unblock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
