import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAuthToken } from '../lib/api';

interface User {
  id: string; email: string; role: string;
  firstName: string; lastName: string;
  phone?: string; avatar?: string;
  tenant?: string;
  programme?: { _id: string; name: string };
}

interface StudentProfile {
  id: string;
  matricNumber: string;
  status: string;
  programme?: { name: string; level: string; code: string; };
  company?: { name: string; address: string; state: string; lat: number; lng: number; };
  supervisor?: { firstName: string; lastName: string; email: string; phone?: string; };
}

interface AuthContextType {
  user: User | null;
  student: StudentProfile | null;
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
    // Clear token from axios instance AND sessionStorage immediately
    setAuthToken(null);
    try {
      await api.post('auth/logout').catch(() => {});
    } finally {
      setUser(null);
      setStudent(null);
      window.location.href = '/login';
    }
  }, []);

  const loadProfile = useCallback(async () => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get('auth/profile');
      setUser(data.user);
      if (data.student) setStudent(data.student);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setAuthToken(null);
        setUser(null);
        setStudent(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const login = async (identifier: string, password: string) => {
    const { data } = await api.post('auth/login', { identifier, password });

    if (data.accessToken) {
      // setAuthToken sets BOTH the axios instance default header AND sessionStorage
      // in one call — this ensures the very next request (fired by Dashboard useEffect)
      // already has the Authorization header attached.
      setAuthToken(data.accessToken);
    }

    setUser(data.user);
    if (data.student) setStudent(data.student);
  };

  const isRole = useCallback((...roles: string[]) => !!user && roles.includes(user.role), [user]);

  return (
    <AuthContext.Provider value={{ user, student, login, logout, loading, isRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
