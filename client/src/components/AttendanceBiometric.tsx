import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { MapPin, AlertCircle, Camera as CameraIcon } from 'lucide-react';
import { getCurrentPosition, haversineDistance } from '../lib/geolocation';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export default function AttendanceBiometric({ onComplete }: { onComplete: () => void }) {
  const { student } = useAuth();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRange, setIsWithinRange] = useState(false);

  useEffect(() => {
    async function fetchLocation() {
      try {
        const userLoc = await getCurrentPosition();
        setLocation(userLoc);
        
        if (student?.company?.lat && student?.company?.lng) {
          const dist = haversineDistance(
            userLoc.lat, userLoc.lng, 
            student.company.lat, student.company.lng
          );
          setDistance(dist);
          setIsWithinRange(dist <= 0.5); // 500 meters
        }
      } catch (err: any) {
        console.error('Location error:', err);
      }
    }
    fetchLocation();
  }, [student]);

  async function handleVerifyAndCheckIn() {
    if (!isWithinRange) {
      toast.error(`You are too far from your assigned company (${distance?.toFixed(2)}km).`);
      return;
    }

    setLoading(true);
    
    try {
      let deviceInfo = 'Web Browser';
      if (Capacitor.isNativePlatform()) {
        const info = await Device.getInfo();
        deviceInfo = `${info.manufacturer} ${info.model} (${info.operatingSystem} ${info.osVersion})`;
      }

      let photoBase64 = '';
      try {
        const image = await Camera.getPhoto({
          quality: 60,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera
        });
        photoBase64 = `data:image/jpeg;base64,${image.base64String}`;
      } catch {
        throw new Error('Camera access denied or cancelled. You must take a selfie to check in.');
      }

      await api.post('/attendance/checkin', {
        lat: location?.lat,
        lng: location?.lng,
        method: 'gps',
        photoBase64,
        deviceInfo
      });
      toast.success('Identity Verified & Checked In!');
      onComplete();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Biometric Attendance & Proof of Presence</h3>
        <div className={`badge badge-${isWithinRange ? 'green' : 'amber'}`}>
          {isWithinRange ? 'Within Range' : 'Out of Range'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'var(--bg-2)', borderRadius: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isWithinRange ? 'var(--green-light)' : 'var(--amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={20} color={isWithinRange ? 'var(--green)' : 'var(--amber)'} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Location Verification</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>
              {distance ? `Distance: ${distance.toFixed(2)}km from workspace` : 'Detecting your location...'}
            </div>
          </div>
        </div>

        {!isWithinRange && distance && (
          <div className="alert alert-warning" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <AlertCircle size={18} />
            <div style={{ fontSize: '0.85rem' }}>
              You must be within **500 meters** of your assigned workspace to sign in. Current deviation: **{(distance * 1000).toFixed(0)}m**.
            </div>
          </div>
        )}

        <button 
          className="btn btn-primary btn-lg" 
          disabled={!isWithinRange || loading}
          onClick={handleVerifyAndCheckIn}
          style={{ height: '56px', fontSize: '1.1rem' }}
        >
          {loading ? <div className="spinner" /> : (
            <><CameraIcon size={24} /> Verify via Selfie & Sign In</>
          )}
        </button>

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-3)' }}>
          Identity verification required via Selfie. Ensure your face is clearly visible.
        </div>
      </div>
    </div>
  );
}
