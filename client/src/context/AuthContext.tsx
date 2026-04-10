import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

interface User {
  id: string; email: string; role: string;
  firstName: string; lastName: string;
  phone?: string; avatar?: string;
  programme?: { _id: string; name: string };
}

interface StudentProfile {
  id: string; 
  matricNumber: string; 
  status: string;
  programme?: {
    name: string;
    level: string;
    code: string;
  };
  company?: {
    name: string;
    address: string;
    state: string;
    lat: number;
    lng: number;
  };
  supervisor?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  startDate?: string; 
  endDate?: string; 
  overallScore?: number;
}

interface AuthContextType {
  user: User | null;
  student: StudentProfile | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout').catch(() => {});
    } finally {
      setUser(null); 
      setStudent(null);
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/profile');
      setUser(data.user);
      if (data.student) setStudent(data.student);
    } catch (err: any) {
      // Only logout if it's a 401 and we're not already trying to login
      if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const login = async (identifier: string, password: string) => {
    const { data } = await api.post('/auth/login', { identifier, password });
    setUser(data.user);
    if (data.student) setStudent(data.student);
  };

  const isRole = useCallback((...roles: string[]) => !!user && roles.includes(user.role), [user]);

  return (
    <AuthContext.Provider value={{ user, student, token: null, login, logout, loading, isRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
