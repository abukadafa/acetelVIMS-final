import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SettingsPage from './pages/SettingsPage';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import StudentList from './components/StudentList';
import CompanyManagement from './components/CompanyManagement';
import UserManagementPage from './pages/UserManagementPage';
import FeedbackPage from './pages/FeedbackPage';
import AuditTrailPage from './pages/AuditTrailPage';
import RecycleBinPage from './pages/RecycleBinPage';
import LogbookPage from './pages/LogbookPage';
import { Toaster, toast } from 'react-hot-toast';
import OfflineIndicator from './components/OfflineIndicator';
import { setupOfflineAutoSync } from './lib/offline';
import { socket, connectSocket, disconnectSocket } from './lib/socket';
import api from './lib/api';

function SyncWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      console.log('📡 Integrating Global SaaS Socket Pipeline...');
      connectSocket(user.id);
      
      socket.on('notification', (data) => {
        toast.success(data.message, { icon: '🔔' });
      });

      return () => {
        disconnectSocket();
        socket.off('notification');
      };
    }
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'student') {
      console.log('🔄 Initializing Ultimate Offline Sync...');
      setupOfflineAutoSync(async (entry) => {
        const formData = new FormData();
        Object.entries(entry).forEach(([key, value]) => {
          if (value !== undefined) formData.append(key, String(value));
        });
        await api.post('/logbook', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(`Synced logbook: ${entry.entryDate}`, { id: `sync-${entry.id}` });
      });
    }
  }, [user]);

  return <>{children}</>;
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
  const { user, loading, isRole } = useAuth();
  
  if (loading) return <div className="page-loader"><div className="spinner spinner-lg"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !isRole(...roles)) return <Navigate to="/" replace />;
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <SyncWrapper>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/reset" element={<ResetPasswordPage />} />
            
            <Route element={<Layout />}>
              <Route index element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              
              {/* Institutional Supervision & Research */}
              <Route path="/logbook" element={<ProtectedRoute><LogbookPage /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute roles={['student']}><Dashboard /></ProtectedRoute>} />
              <Route path="/map" element={<ProtectedRoute roles={['admin', 'prog_coordinator', 'internship_coordinator']}><Dashboard /></ProtectedRoute>} />
              <Route path="/all-students" element={<ProtectedRoute roles={['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support']}><StudentList /></ProtectedRoute>} />
              <Route path="/companies" element={<ProtectedRoute roles={['admin', 'internship_coordinator']}><CompanyManagement /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute roles={['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support']}><UserManagementPage /></ProtectedRoute>} />
              <Route path="/audit-trail" element={<ProtectedRoute roles={['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support']}><AuditTrailPage /></ProtectedRoute>} />
              <Route path="/bin" element={<ProtectedRoute roles={['admin']}><RecycleBinPage /></ProtectedRoute>} />
              
              {/* Common Routes */}
              <Route path="/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            </Route>
  
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          
          <OfflineIndicator />
          <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff', borderRadius: '12px' } }} />
        </BrowserRouter>
      </SyncWrapper>
    </AuthProvider>
  );
}
