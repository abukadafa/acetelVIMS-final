import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { MapPin, AlertCircle, Camera as CameraIcon, Sun, Sunset, CheckCircle2, Clock } from 'lucide-react';
import { getCurrentPosition, haversineDistance } from '../lib/geolocation';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

type Session = 'morning' | 'afternoon';

interface SessionRecord {
  _id?: string;
  session: Session;
  checkInTime?: string;
  checkOutTime?: string;
  isValid?: boolean;
  distanceFromCompany?: number;
}

export default function AttendanceBiometric({ onComplete }: { onComplete: () => void }) {
  const { student } = useAuth();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session>('morning');
  const [morning, setMorning] = useState<SessionRecord | null>(null);
  const [afternoon, setAfternoon] = useState<SessionRecord | null>(null);

  useEffect(() => {
    loadTodayStatus();
    fetchLocation();
  }, [student]);

  async function loadTodayStatus() {
    try {
      const { data } = await api.get('/attendance/today');
      setCurrentSession(data.currentSession || 'morning');
      setMorning(data.morning || null);
      setAfternoon(data.afternoon || null);
    } catch {
      const hour = new Date().getHours();
      setCurrentSession(hour < 13 ? 'morning' : 'afternoon');
    }
  }

  async function fetchLocation() {
    try {
      const userLoc = await getCurrentPosition();
      setLocation(userLoc);
      if (student?.company?.lat && student?.company?.lng) {
        const dist = haversineDistance(userLoc.lat, userLoc.lng, student.company.lat, student.company.lng);
        setDistance(dist);
        setIsWithinRange(dist <= 0.5);
      } else {
        setIsWithinRange(true);
      }
    } catch (err: any) {
      console.error('Location error:', err);
    }
  }

  const activeSession: Session = currentSession;
  const activeRecord = activeSession === 'morning' ? morning : afternoon;
  const alreadyCheckedIn = !!activeRecord?.checkInTime;
  const canCheckOut = alreadyCheckedIn && !activeRecord?.checkOutTime;

  async function handleVerifyAndCheckIn(session: Session) {
    if (!isWithinRange && student?.company?.lat) {
      toast.error(`You are too far from your assigned company (${distance?.toFixed(2)}km).`);
      return;
    }

    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        await Device.getInfo();
      }

      let photoBase64 = '';
      try {
        const image = await Camera.getPhoto({
          quality: 60,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
        });
        photoBase64 = `data:image/jpeg;base64,${image.base64String}`;
      } catch {
        throw new Error('Camera access denied or cancelled. You must take a selfie to check in.');
      }

      const pos = location || await getCurrentPosition();
      const { data } = await api.post('/attendance/checkin', {
        lat: pos.lat,
        lng: pos.lng,
        method: 'gps',
        photoBase64,
        session,
      });

      toast.success(data.message || `${session} check-in successful`);
      await loadTodayStatus();
      onComplete();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckOut(session: Session) {
    setLoading(true);
    try {
      const { data } = await api.post('/attendance/checkout', { session });
      toast.success(data.message || `${session} check-out successful`);
      await loadTodayStatus();
      onComplete();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Check-out failed');
    } finally {
      setLoading(false);
    }
  }

  function SessionCard({ session, record, label, icon: Icon }: { session: Session; record: SessionRecord | null; label: string; icon: React.ElementType }) {
    const checkedIn = !!record?.checkInTime;
    const checkedOut = !!record?.checkOutTime;
    const isActive = currentSession === session;

    return (
      <div style={{
        padding: 16, borderRadius: 12, border: `1.5px solid ${checkedIn ? 'var(--success)' : isActive ? 'var(--primary)' : 'var(--border)'}`,
        background: checkedIn ? 'rgba(22,163,74,0.05)' : 'var(--bg-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Icon size={18} color={checkedIn ? 'var(--success)' : 'var(--primary)'} />
          <div style={{ fontWeight: 700 }}>{label}</div>
          {isActive && <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>Current</span>}
        </div>
        {checkedIn ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} color="var(--success)" />
              Checked in at {new Date(record!.checkInTime!).toLocaleTimeString()}
            </div>
            {checkedOut && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Clock size={14} />
                Checked out at {new Date(record!.checkOutTime!).toLocaleTimeString()}
              </div>
            )}
            {!checkedOut && isActive && (
              <button className="btn btn-sm btn-outline" style={{ marginTop: 10 }}
                disabled={loading} onClick={() => handleCheckOut(session)}>
                Check Out ({label})
              </button>
            )}
          </div>
        ) : isActive ? (
          <button className="btn btn-primary btn-sm" disabled={loading || !isWithinRange}
            onClick={() => handleVerifyAndCheckIn(session)}>
            {loading ? <div className="spinner" /> : <><CameraIcon size={16} /> Check In — {label}</>}
          </button>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Not yet recorded</div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Daily Attendance — Morning & Afternoon</h3>
        <div className={`badge badge-${isWithinRange ? 'green' : 'amber'}`}>
          {isWithinRange ? 'Within Range' : 'Out of Range'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--bg-2)', borderRadius: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: isWithinRange ? 'var(--green-light)' : 'var(--amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={20} color={isWithinRange ? 'var(--green)' : 'var(--amber)'} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Location Verification</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>
              {distance != null ? `Distance: ${distance.toFixed(2)}km from workspace` : 'Detecting your location...'}
            </div>
          </div>
        </div>

        {!isWithinRange && distance != null && student?.company?.lat && (
          <div className="alert alert-warning" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle size={18} />
            <div style={{ fontSize: '0.85rem' }}>
              You must be within 500 meters of your assigned workspace to sign in.
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <SessionCard session="morning" record={morning} label="Morning Session" icon={Sun} />
          <SessionCard session="afternoon" record={afternoon} label="Afternoon Session" icon={Sunset} />
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-3)' }}>
          Two attendance sessions per day: before 1:00 PM (morning) and after 1:00 PM (afternoon). Selfie required.
        </div>
      </div>
    </div>
  );
}
