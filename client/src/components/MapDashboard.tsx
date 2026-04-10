import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import api from '../lib/api';
import { Users, MapPin, Activity, AlertTriangle } from 'lucide-react';

// Fix for default marker icons in Leaflet + Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapStudent {
  _id: string;
  user: {
    firstName: string;
    lastName: string;
  };
  matricNumber: string;
  status: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  lat: number;
  lng: number;
  lastSeen: string;
  programme: {
    name: string;
    level: string;
  };
  company?: {
    name: string;
    lat: number;
    lng: number;
  };
}

export default function MapDashboard() {
  const [students, setStudents] = useState<MapStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, highRisk: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get('/students/map');
        setStudents(data.students);
        
        const active = data.students.filter((s: any) => s.status === 'active').length;
        const highRisk = data.students.filter((s: any) => s.riskLevel === 'High').length;
        setStats({ total: data.students.length, active, highRisk });
      } catch (err) {
        console.error('Map Load Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Live update every minute
    return () => clearInterval(interval);
  }, []);

  const nigeriaCenter: [number, number] = [9.0820, 8.6753];

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div className="card-header" style={{ padding: '20px 24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 className="card-title">ACETEL Student Tracking Dashboard</h3>
          <div className="badge badge-green">Real-time Pulse</div>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', marginLeft: 'auto' }}>
          <div className="stat-pill">
            <Users size={14} /> <strong>{stats.total}</strong> Students
          </div>
          <div className="stat-pill" style={{ color: 'var(--green)' }}>
            <Activity size={14} /> <strong>{stats.active}</strong> Active
          </div>
          <div className="stat-pill" style={{ color: 'var(--red)' }}>
            <AlertTriangle size={14} /> <strong>{stats.highRisk}</strong> High Risk
          </div>
        </div>
      </div>
      
      <div style={{ height: '600px', width: '100%', position: 'relative' }}>
        <MapContainer center={nigeriaCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MarkerClusterGroup chunkedLoading>
            {students.map((student) => (
              <React.Fragment key={student._id}>
                {student.lat && student.lng && (
                  <Marker position={[student.lat, student.lng]}>
                    <Popup>
                      <div style={{ minWidth: '200px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: '1.1rem', color: '#003366' }}>
                            {student.user.firstName} {student.user.lastName}
                          </strong>
                          <span className={`badge badge-${student.riskLevel === 'High' ? 'red' : student.riskLevel === 'Medium' ? 'amber' : 'green'}`} style={{ fontSize: '0.65rem' }}>
                            {student.riskLevel?.toUpperCase()} RISK
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>{student.matricNumber}</span>
                        
                        <div className="divider" style={{ margin: '10px 0' }} />
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={14} /> {student.company?.name || 'Allocation Pending'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Activity size={14} /> {student.programme.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#999', fontSize: '0.75rem' }}>
                            Last Sync: {student.lastSeen ? new Date(student.lastSeen).toLocaleString() : 'Never'}
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {student.company?.lat && student.company?.lng && (
                  <CircleMarker 
                    center={[student.company.lat, student.company.lng]} 
                    pathOptions={{ color: '#003366', fillColor: '#003180', fillOpacity: 0.1 }}
                    radius={20}
                  >
                    <Popup>
                      <strong>{student.company.name}</strong><br/>
                      Designated Internship Workspace
                    </Popup>
                  </CircleMarker>
                )}
              </React.Fragment>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}
