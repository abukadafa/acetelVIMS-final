import { useEffect, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import api from '../lib/api';
import { Users, CheckCircle, Clock, AlertTriangle, BookOpen, Star, Activity, Download } from 'lucide-react';
import toast from 'react-hot-toast';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, ArcElement
);

interface ProgrammeStat {
  code: string;
  programme: string;
  level: string;
  total: number;
  active: number;
  completed: number;
  avgRating: number;
  attendanceRate: number;
}

export default function AnalyticsDashboard({ visibleRoles = [] }: { visibleRoles?: string[] }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/summary')
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Failed to load global analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="page-loader"><div className="spinner"></div></div>;

  const { summary, byProgramme, registrationTrend } = data;

  // Global KPIs
  const kpis = [
    { label: 'Total Enrollment', value: summary.totalStudents, icon: Users, color: 'var(--primary)', sub: 'Across 6 Tracks' },
    { label: 'Active Interns', value: summary.activeStudents, icon: Activity, color: 'var(--blue)', sub: `${Math.round((summary.activeStudents / summary.totalStudents) * 100) || 0}% Placement Rate` },
    { label: 'Avg Attendance', value: `${summary.attendanceRate}%`, icon: CheckCircle, color: 'var(--success)', sub: 'Verified via Biometrics' },
    { label: 'Pending Reviews', value: summary.pendingLogbooks, icon: Clock, color: 'var(--warning)', sub: 'Requires Supervisor Action' },
  ];

  // Distribution Chart
  const distributionChart = {
    labels: byProgramme.map((p: ProgrammeStat) => p.code),
    datasets: [
      {
        label: 'Active',
        data: byProgramme.map((p: ProgrammeStat) => p.active),
        backgroundColor: '#0a5c36',
        borderRadius: 6,
      },
      {
        label: 'Total',
        data: byProgramme.map((p: ProgrammeStat) => p.total),
        backgroundColor: 'rgba(10, 92, 54, 0.1)',
        borderRadius: 6,
      },
    ],
  };

  const performanceChart = {
    labels: byProgramme.map((p: ProgrammeStat) => p.code),
    datasets: [{
      label: 'Avg Supervisor Rating',
      data: byProgramme.map((p: ProgrammeStat) => p.avgRating || 0),
      backgroundColor: [
        'rgba(10, 92, 54, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(245, 158, 11, 0.8)',
        'rgba(16, 185, 129, 0.8)', 'rgba(99, 102, 241, 0.8)', 'rgba(236, 72, 153, 0.8)'
      ],
      borderWidth: 0,
    }]
  };

  return (
    <div className="analytics-dashboard animate-fade">
      {/* ── Institutional KPIs ── */}
      <div className="stats-grid" style={{ marginBottom: '32px' }}>
        {kpis.map((kpi, i) => (
          <div key={i} className="stat-card premium">
            <div className="stat-card-row">
              <div className="stat-card-info">
                <span className="stat-label">{kpi.label}</span>
                <div className="stat-value" style={{ color: kpi.color }}>{kpi.value}</div>
                <span className="stat-sub">{kpi.sub}</span>
              </div>
              <div className="stat-card-icon" style={{ background: `${kpi.color}15`, color: kpi.color }}>
                <kpi.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Programme Performance Matrix ── */}
      <div className="grid-3" style={{ marginBottom: '32px' }}>
        {byProgramme.map((p: ProgrammeStat) => (
          <div key={p.code} className="card programme-card">
            <div className="programme-header">
              <div className="programme-badge">{p.level}</div>
              <h4 className="programme-title">{p.programme}</h4>
            </div>
            <div className="programme-metrics">
              <div className="p-metric">
                <span className="p-label">Placement</span>
                <span className="p-value">{Math.round((p.active / p.total) * 100) || 0}%</span>
                <div className="p-bar"><div className="p-fill" style={{ width: `${(p.active / p.total) * 100 || 0}%`, background: 'var(--primary)' }}></div></div>
              </div>
              <div className="p-metric-row">
                <div className="p-mini-metric">
                   <Star size={14} className="text-amber" /> 
                   <span>{p.avgRating || '—'}</span>
                </div>
                <div className="p-mini-metric">
                   <Activity size={14} className="text-blue" />
                   <span>{p.attendanceRate}%</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Analytic Charts ── */}
      <div className="grid-2" style={{ marginBottom: '32px' }}>
        <div className="card shadow-sm">
          <div className="card-header">
            <h3 className="card-title">Placement Distribution by Programme</h3>
            <button className="btn btn-xs btn-ghost"><Download size={14} /></button>
          </div>
          <div style={{ padding: '20px' }}>
            <Bar 
              data={distributionChart} 
              options={{ 
                responsive: true,
                plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 12, usePointStyle: true } } },
                scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
              }} 
            />
          </div>
        </div>
        <div className="card shadow-sm">
          <div className="card-header">
            <h3 className="card-title">Supervisory Rating Index</h3>
            <button className="btn btn-xs btn-ghost"><Download size={14} /></button>
          </div>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: '300px' }}>
              <Doughnut 
                data={performanceChart} 
                options={{ 
                  responsive: true,
                  plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10, usePointStyle: true, padding: 15 } } },
                  cutout: '70%'
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Quality Control & Risk ── */}
      <div className="card border-danger">
        <div className="card-header bg-danger-light">
          <h3 className="card-title text-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} /> High-Priority Compliance Warnings
          </h3>
          <span className="badge badge-red">{data.atRisk.length} Students At Risk</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Student Profile</th>
                <th>Matrix No.</th>
                <th>Academic Track</th>
                <th>Last Verified Logbook</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Management Action</th>
              </tr>
            </thead>
            <tbody>
              {data.atRisk.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                    Institutional health is optimal. No compliance warnings detected.
                  </td>
                </tr>
              ) : (
                data.atRisk.map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                    </td>
                    <td><span className="code-font">{s.matric}</span></td>
                    <td><span className="badge badge-gray">{s.programme}</span></td>
                    <td className="text-danger" style={{ fontWeight: 500 }}>{s.lastEntry || 'Never Recorded'}</td>
                    <td><span className="status-indicator red"></span> Critical Delay</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-outline-danger">Issue Formal Notice</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .programme-card {
          border: 1px solid var(--border);
          transition: all 0.2s ease;
        }
        .programme-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 20px -10px rgba(0,0,0,0.1);
          border-color: var(--primary);
        }
        .programme-header {
          margin-bottom: 16px;
        }
        .programme-badge {
          display: inline-block;
          padding: 2px 8px;
          background: var(--surface-2);
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--primary);
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .programme-title {
          font-size: 0.95rem;
          font-weight: 700;
          line-height: 1.3;
        }
        .programme-metrics {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .p-label {
          font-size: 0.75rem;
          color: var(--text-3);
          display: block;
          margin-bottom: 4px;
        }
        .p-value {
          font-size: 0.85rem;
          font-weight: 700;
          float: right;
        }
        .p-bar {
          height: 6px;
          background: var(--surface-3);
          border-radius: 3px;
          margin-top: 8px;
          overflow: hidden;
        }
        .p-fill {
          height: 100%;
          border-radius: 3px;
        }
        .p-metric-row {
          display: flex;
          gap: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .p-mini-metric {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .stat-card.premium {
          padding: 24px;
          border: none;
          background: var(--surface-1);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .stat-card-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .stat-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-sub {
          font-size: 0.7rem;
          opacity: 0.6;
          display: block;
          margin-top: 4px;
        }
        .bg-danger-light { background: rgba(220, 38, 38, 0.05); }
        .border-danger { border: 1px solid rgba(220, 38, 38, 0.2); }
        .text-danger { color: #dc2626; }
        .code-font { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; }
      `}</style>
    </div>
  );
}
