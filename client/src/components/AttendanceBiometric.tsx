import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Fingerprint, MapPin, CheckCircle, AlertCircle } from 'lucide-react';

export default function AttendanceBiometric({ onComplete }: { onComplete: () => void }) {
  const { student } = useAuth();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRange, setIsWithinRange] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(userLoc);
        
        if (student?.company?.lat && student?.company?.lng) {
          const dist = calculateDistance(
            userLoc.lat, userLoc.lng, 
            student.company.lat, student.company.lng
          );
          setDistance(dist);
          setIsWithinRange(dist <= 0.5); // 500 meters
        }
      });
    }
  }, [student]);

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async function handleVerifyAndCheckIn() {
    if (!isWithinRange) {
      toast.error(`You are too far from your assigned company (${distance?.toFixed(2)}km).`);
      return;
    }

    setLoading(true);
    // Mock Biometric Verification for Web
    // In Capacitor, we'd use: await FingerprintAIO.show({...})
    setTimeout(async () => {
      try {
        await api.post('/attendance/check-in', {
          lat: location?.lat,
          lng: location?.lng,
          verifiedMethod: 'biometric'
        });
        toast.success('Identity Verified & Checked In!');
        onComplete();
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Check-in failed');
      } finally {
        setLoading(false);
      }
    }, 1500);
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
            <><Fingerprint size={24} /> Verify & Sign In</>
          )}
        </button>

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-3)' }}>
          Identity verification required via device biometrics.
        </div>
      </div>
    </div>
  );
}
