import { useState, useEffect } from 'react';
import { CloudOff, RefreshCcw, Wifi } from 'lucide-react';
import { getPendingSyncCount, isOnline, setupOfflineAutoSync } from '../lib/offline';
import api from '../lib/api';
import { toast } from 'react-hot-toast';

export default function OfflineIndicator() {
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(getPendingSyncCount());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleStatus = () => setOnline(isOnline());
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);

    setupOfflineAutoSync(async (entries: any) => {
      setSyncing(true);
      try {
        await api.post('/logbook/sync', { entries });
        setPendingCount(0);
        toast.success(`Successfully synced ${entries.length} offline entries!`);
      } catch (err) {
        console.error('Auto-sync failed');
      } finally {
        setSyncing(false);
      }
    });

    const interval = setInterval(() => {
      setPendingCount(getPendingSyncCount());
    }, 5000);

    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
      clearInterval(interval);
    };
  }, []);

  if (online && pendingCount === 0) return null;

  return (
    <div className={`offline-bar ${online ? 'badge-blue' : 'badge-amber'}`} style={{ 
      position: 'fixed', bottom: 0, left: 'var(--sidebar-w)', right: 0, 
      zIndex: 1000, padding: '8px 24px', justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {online ? <Wifi size={18} /> : <CloudOff size={18} />}
        <span>
          {online 
            ? `Online. ${pendingCount} pending entries detected.` 
            : `Offline Mode. Working without internet. ${pendingCount} entries saved locally.`}
        </span>
      </div>
      {online && pendingCount > 0 && (
        <button 
          className="btn btn-sm btn-primary" 
          onClick={() => window.dispatchEvent(new Event('online'))}
          disabled={syncing}
        >
          {syncing ? <RefreshCcw className="spinner" size={14} /> : 'Sync Now'}
        </button>
      )}
    </div>
  );
}
