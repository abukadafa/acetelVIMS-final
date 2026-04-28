import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Navigate } from 'react-router-dom';
import {
  Smartphone, CheckCircle, XCircle, Send, ExternalLink,
  Copy, ChevronRight, AlertCircle, RefreshCw, Info,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CommsStatus {
  whatsapp: { active: boolean; provider: string | null };
}

const STEPS = [
  {
    num: 1,
    title: 'Create a Meta Developer Account',
    description: 'Go to the Meta Developer portal and sign in with your Facebook account. It\'s free — no credit card required.',
    action: { label: 'Open Meta Developers →', url: 'https://developers.facebook.com' },
    detail: 'If you don\'t have a Facebook account, create one. Then visit developers.facebook.com and click "Get Started".',
  },
  {
    num: 2,
    title: 'Create a New App',
    description: 'Click "My Apps" → "Create App". Choose "Business" as the app type. Give it any name (e.g. "ACETEL IMS").',
    action: null,
    detail: 'If asked about a Business Portfolio, you can skip it for now by clicking "I don\'t want to connect a portfolio yet".',
  },
  {
    num: 3,
    title: 'Add the WhatsApp Product',
    description: 'Inside your new app dashboard, scroll down and find "WhatsApp". Click "Set Up" to add it to your app.',
    action: null,
    detail: 'This takes you to the WhatsApp Getting Started page where you\'ll find your credentials.',
  },
  {
    num: 4,
    title: 'Copy your Phone Number ID',
    description: 'On the WhatsApp → Getting Started page, you\'ll see "Phone Number ID" (a long number like 1234567890123456). Copy it.',
    action: null,
    detail: 'This is NOT the actual WhatsApp phone number. It\'s a unique ID Meta assigns to your sender number.',
  },
  {
    num: 5,
    title: 'Get your Access Token',
    description: 'On the same page, click "Generate Access Token" (or copy the "Temporary Access Token" shown). This is your WA_ACCESS_TOKEN.',
    action: null,
    detail: 'The temporary token expires in ~24 hours. For permanent use, create a System User under Business Settings and generate a permanent token.',
  },
  {
    num: 6,
    title: 'Add ENV vars to Render',
    description: 'Go to your Render backend service → Environment → add the three variables shown below. Click Save.',
    action: { label: 'Open Render Dashboard →', url: 'https://dashboard.render.com' },
    detail: 'After saving, Render will automatically redeploy. Wait 2-3 minutes, then the WhatsApp status above will turn green.',
  },
  {
    num: 7,
    title: 'Add test phone & send test message',
    description: 'Meta\'s free tier requires you to add recipient numbers as "test numbers" before messaging them. Add your own number, then use the test sender below.',
    action: { label: 'Add Test Numbers →', url: 'https://developers.facebook.com/apps/' },
    detail: 'In your Meta App → WhatsApp → API Setup → "To" field, add your phone number. Then use the test panel below.',
  },
];

export default function WhatsAppSetupPage() {
  const { isRole } = useAuth();
  const [status, setStatus] = useState<CommsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    api.get('/auth/comms-status')
      .then(r => setStatus(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!isRole('admin')) return <Navigate to="/" replace />;

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const r = await api.get('/auth/comms-status');
      setStatus(r.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/auth/whatsapp-test', { phone: testPhone.trim() });
      setTestResult(data);
      if (data.success) toast.success('WhatsApp test sent!');
      else toast.error(data.message);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Test failed';
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally { setTestLoading(false); }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const isActive = status?.whatsapp?.active;

  const ENV_VARS = [
    { key: 'WA_PHONE_NUMBER_ID', value: 'Paste your Phone Number ID here', example: '1234567890123456' },
    { key: 'WA_ACCESS_TOKEN',    value: 'Paste your Access Token here',    example: 'EAAxxxxxxxxxxxxxxxxxxxxxxxx' },
    { key: 'WA_WEBHOOK_VERIFY_TOKEN', value: 'acetel_webhook_2025',       example: 'acetel_webhook_2025' },
  ];

  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Smartphone size={24} style={{ color: '#25D366' }} /> WhatsApp Setup
          </h1>
          <p className="page-subtitle">Configure free WhatsApp notifications via Meta Cloud API — no credit card, no Twilio</p>
        </div>
        <button className="btn btn-outline" onClick={refreshStatus} disabled={loading}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh Status
        </button>
      </div>

      {/* Status banner */}
      <div style={{
        padding: '16px 20px', borderRadius: '12px', marginBottom: '28px',
        background: isActive ? '#f0fdf4' : '#fff7ed',
        border: `1.5px solid ${isActive ? '#86efac' : '#fed7aa'}`,
        display: 'flex', alignItems: 'center', gap: '14px',
      }}>
        {isActive
          ? <CheckCircle size={28} style={{ color: '#16a34a', flexShrink: 0 }} />
          : <AlertCircle size={28} style={{ color: '#d97706', flexShrink: 0 }} />
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: isActive ? '#15803d' : '#92400e' }}>
            {isActive ? '✅ WhatsApp is Active — Meta Cloud API Connected' : '⚙️ WhatsApp Not Yet Configured'}
          </div>
          <div style={{ fontSize: '13px', color: isActive ? '#16a34a' : '#b45309', marginTop: '2px' }}>
            {isActive
              ? `Provider: ${status?.whatsapp?.provider} · Use the test panel below to send a test message`
              : 'Follow the steps below to activate free WhatsApp notifications — takes about 15 minutes'}
          </div>
        </div>
        {isActive && (
          <span style={{ background: '#16a34a', color: '#fff', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
            LIVE
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px', alignItems: 'start' }}>

        {/* ── LEFT: Setup steps ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} style={{ color: 'var(--primary)' }} /> Setup Guide — Meta WhatsApp Cloud API (Free)
            </h3>

            {STEPS.map((step, i) => (
              <div key={step.num} style={{ display: 'flex', gap: '16px', marginBottom: i < STEPS.length - 1 ? '20px' : 0 }}>
                {/* Step number + connector line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: isActive && step.num <= 6 ? '#16a34a' : 'var(--primary)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '14px',
                  }}>
                    {isActive && step.num <= 6 ? <CheckCircle size={16} /> : step.num}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ width: '2px', flex: 1, background: 'var(--border)', minHeight: '20px', margin: '4px 0' }} />
                  )}
                </div>

                {/* Step content */}
                <div style={{ flex: 1, paddingBottom: i < STEPS.length - 1 ? '8px' : 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', marginBottom: '4px' }}>
                    {step.title}
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                    {step.description}
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.5', fontStyle: 'italic' }}>
                    {step.detail}
                  </p>
                  {step.action && (
                    <a href={step.action.url} target="_blank" rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      {step.action.label} <ExternalLink size={11} />
                    </a>
                  )}

                  {/* Step 6: ENV vars display */}
                  {step.num === 6 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {ENV_VARS.map(v => (
                        <div key={v.key} style={{ background: '#1e293b', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>Key</div>
                            <code style={{ color: '#a5f3fc', fontSize: '13px' }}>{v.key}</code>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', marginBottom: '2px' }}>Example Value</div>
                            <code style={{ color: '#86efac', fontSize: '12px' }}>{v.example}</code>
                          </div>
                          <button
                            onClick={() => copyToClipboard(v.key, v.key)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#94a3b8', padding: '4px', flexShrink: 0 }}
                            title="Copy key name">
                            {copied === v.key ? <CheckCircle size={14} style={{ color: '#86efac' }} /> : <Copy size={14} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Test panel + free tier info ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Test panel */}
          <div className="card" style={{ padding: '24px', border: `2px solid ${isActive ? '#86efac' : 'var(--border)'}` }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={16} style={{ color: '#25D366' }} /> Send Test Message
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-3)' }}>
              {isActive
                ? 'WhatsApp is active. Enter a phone number to send a live test message.'
                : 'Complete the setup steps first, then use this panel to verify everything works.'}
            </p>

            <form onSubmit={handleTest}>
              <div className="form-group">
                <label className="form-label">Phone Number (with country code)</label>
                <input
                  className="form-input"
                  placeholder="+2348012345678"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  disabled={!isActive}
                  style={{ opacity: isActive ? 1 : 0.5 }}
                />
                <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--text-3)' }}>
                  Nigerian numbers: start with +234 or 0 (auto-converted)
                </p>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', background: '#25D366', border: 'none', marginTop: '8px' }}
                disabled={!isActive || testLoading || !testPhone.trim()}>
                {testLoading
                  ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                  : <><Send size={14} /> Send Test WhatsApp</>}
              </button>
            </form>

            {testResult && (
              <div style={{
                marginTop: '14px', padding: '12px 14px', borderRadius: '10px',
                background: testResult.success ? '#f0fdf4' : '#fff5f5',
                border: `1px solid ${testResult.success ? '#86efac' : '#fca5a5'}`,
                display: 'flex', gap: '10px', alignItems: 'flex-start',
              }}>
                {testResult.success
                  ? <CheckCircle size={16} style={{ color: '#16a34a', flexShrink: 0, marginTop: '1px' }} />
                  : <XCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />}
                <span style={{ fontSize: '13px', color: testResult.success ? '#15803d' : '#b91c1c' }}>
                  {testResult.message}
                </span>
              </div>
            )}
          </div>

          {/* Why Meta over Twilio */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: 700 }}>🆚 Meta Cloud API vs Twilio</h3>
            {[
              { label: 'Cost',          meta: 'FREE (1,000 msg/month)', twilio: '$0.005 per message + monthly fee' },
              { label: 'Setup',         meta: '~15 minutes',            twilio: 'Account + card + approval' },
              { label: 'Credit card',   meta: '❌ Not required',        twilio: '✅ Required' },
              { label: 'Official API',  meta: '✅ Direct from Meta',    twilio: '3rd party wrapper' },
              { label: 'Nigeria ready', meta: '✅ Works with MTN/Airtel',twilio: 'Additional setup needed' },
            ].map(row => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: '8px', marginBottom: '10px', fontSize: '12px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-3)' }}>{row.label}</span>
                <span style={{ background: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>{row.meta}</span>
                <span style={{ background: '#f9fafb', color: '#6b7280', padding: '2px 8px', borderRadius: '6px' }}>{row.twilio}</span>
              </div>
            ))}
          </div>

          {/* Webhook info for receiving messages */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700 }}>🔗 Webhook URL (Optional)</h3>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.5' }}>
              To receive incoming WhatsApp replies in the app, add this URL in your Meta App → WhatsApp → Configuration:
            </p>
            <div style={{ background: '#1e293b', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <code style={{ color: '#a5f3fc', fontSize: '12px', flex: 1, wordBreak: 'break-all' }}>
                https://acetel-backend.onrender.com/api/auth/whatsapp-webhook
              </code>
              <button
                onClick={() => copyToClipboard('https://acetel-backend.onrender.com/api/auth/whatsapp-webhook', 'webhook')}
                className="btn btn-ghost btn-sm" style={{ color: '#94a3b8', flexShrink: 0 }}>
                {copied === 'webhook' ? <CheckCircle size={13} style={{ color: '#86efac' }} /> : <Copy size={13} />}
              </button>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-3)' }}>
              Verify token: <code style={{ background: 'var(--surface-2)', padding: '1px 6px', borderRadius: '4px' }}>acetel_webhook_2025</code>
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
