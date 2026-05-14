import MapDashboard from '../components/MapDashboard';
import { MapPin } from 'lucide-react';

export default function LiveTrackingPage() {
  return (
    <div className="page-container animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={22} style={{ color: 'var(--primary)' }} /> Live Tracking
          </h1>
          <p className="page-subtitle">Real-time map view of active interns and partner locations</p>
        </div>
      </div>
      <MapDashboard />
    </div>
  );
}

