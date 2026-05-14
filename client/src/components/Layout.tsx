import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import { useAuth } from '../context/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';

export default function Layout() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="page-loader">
      <div className="spinner spinner-lg"></div>
      <p style={{ marginTop: '16px', color: '#6b7280', fontSize: '14px' }}>
        Connecting to server…
      </p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="institutional-footer">
          © 2026 ACETEL Virtual Internship Management System | NOUN <br />
          Africa Centre of Excellence on Technology Enhanced Learning
        </footer>
      </div>
      <BottomNav />
      <style>{`
        @media (max-width: 768px) {
          .app-layout { display: block; }
          .sidebar { display: none; }
          .main-content { margin-left: 0 !important; padding-bottom: 80px; }
          .page-content { padding: 16px; }
          .navbar { padding: 10px 16px; }
          .institutional-footer { display: none; }
        }
      `}</style>
    </div>
  );
}
