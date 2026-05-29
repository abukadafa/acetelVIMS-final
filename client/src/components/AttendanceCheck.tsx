import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { getCurrentPosition, formatDistance } from '../lib/geolocation';
import { toast } from 'react-hot-toast';
import { MapPin, CheckCircle2, AlertCircle, Clock, MapIcon, Camera as CameraIcon } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export default function AttendanceCheck({ onComplete }: { onComplete: () => void }) {
  const { user, student } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<any>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    loadTodayAttendance();
  }, [user]);

  async function loadTodayAttendance() {
    try {
      const { data } = await api.get('/attendance');
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = data.records.find((r: any) => r.check_in_time.startsWith(today));
      if (todayRecord) {
        setCheckedIn(true);
        setLastCheckIn(todayRecord);
      }
    } catch {
      console.error('Failed to load attendance');
    }
  }

  async function handleCheckIn() {
    setLoading(true);
    setLocationError(null);

    try {
      // 1. Take Selfie
      let photoBase64 = '';
      try {
        const image = await Camera.getPhoto({
          quality: 60,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera
        });
        photoBase64 = `data:image/jpeg;base64,${image.base64String}`;
      } catch (err: any) {
        throw new Error('Camera access denied or cancelled. You must take a selfie to check in.');
      }

      // 2. Get GPS Location
      const position = await getCurrentPosition();

      // 3. Send to Backend
      const { data } = await api.post('/attendance/checkin', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        photoBase64,
      });

      if (data.isValid) {
        toast.success(data.message);
      } else {
        toast.error(data.message, { duration: 6000 });
      }

      setCheckedIn(true);
      setLastCheckIn(data);
      onComplete();
    } catch (err: any) {
      if (err.message === 'Geolocation not supported' || err.code === 1) {
        setLocationError('GPS access denied. Please enable location to check in.');
      } else if (err.message?.includes('Camera')) {
        setLocationError(err.message);
      } else {
        toast.error(err.response?.data?.error || err.message || 'Failed to check in');
      }
    } finally {
      setLoading(false);
    }
  }

  if (checkedIn && lastCheckIn) {
    return (
      <div className="card" style={{ border: '1px solid var(--success)', background: 'rgba(22,163,74,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="stat-icon green"><CheckCircle2 size={24} /></div>
          <div>
            <h4 style={{ color: 'var(--success)', marginBottom: '4px' }}>Checked In Today</h4>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem', color: 'var(--text-2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {new Date(lastCheckIn.check_in_time).toLocaleTimeString()}</span>
              {lastCheckIn.distance_from_company && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> At {student?.company?.name} ({formatDistance(lastCheckIn.distance_from_company)})</span>
              )}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div className={`badge badge-${lastCheckIn.is_valid ? 'green' : 'amber'}`}>
              {lastCheckIn.is_valid ? 'Verified Location' : 'Outside Radius'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Daily Attendance Check-In</h3>
        <div className="badge badge-blue"><MapIcon size={14} /> GPS + Selfie</div>
      </div>
      
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        <div style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Please ensure you are at your assigned workplace (<strong>{student?.company?.name}</strong>) before checking in. You will be prompted to take a selfie.
        </div>

        {locationError && (
          <div className="alert alert-error" style={{ marginBottom: '20px' }}>
            <AlertCircle size={18} /> {locationError}
          </div>
        )}

        <button 
          className="btn btn-primary btn-lg" 
          onClick={handleCheckIn} 
          disabled={loading}
          style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '50px' }}
        >
          {loading ? (
            <><div className="spinner" /> Verifying...</>
          ) : (
            <><CameraIcon size={22} /> Take Selfie & Check In</>
          )}
        </button>
      </div>
    </div>
  );
}
