import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setMemoryToken } from '../lib/api';

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
  programme?: { name: string; level: string; code: string; };
  company?: { name: string; address: string; state: string; lat: number; lng: number; };
  supervisor?: { firstName: string; lastName: string; email: string; phone?: string; };
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

// Persist token in sessionStorage so it survives page reloads within the tab
const TOKEN_KEY = 'acetel_access_token';

function saveToken(token: string) {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch {}
  setMemoryToken(token);
}

function clearToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
  setMemoryToken(null);
}

function restoreToken() {
  try {
    const t = sessionStorage.getItem(TOKEN_KEY);
    if (t) setMemoryToken(t);
    return t;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    clearToken();
    try {
      await api.post('auth/logout').catch(() => {});
    } finally {
      setUser(null);
      setStudent(null);
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
  }, []);

  const loadProfile = useCallback(async () => {
    // Restore token from sessionStorage first (survives React re-mounts)
    restoreToken();
    try {
      const { data } = await api.get('auth/profile');
      setUser(data.user);
      if (data.student) setStudent(data.student);
    } catch (err: any) {
      if (err.response?.status === 401) {
        clearToken();
        // Only redirect if we have no token at all (not just a race condition)
        const hasToken = !!sessionStorage.getItem(TOKEN_KEY);
        if (!hasToken && !window.location.pathname.includes('/login')) {
          setUser(null);
          setStudent(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [logout]);

  // Load profile once on mount
  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (identifier: string, password: string) => {
    const { data } = await api.post('auth/login', { identifier, password });
    
    // Save token from response body — works even when cookies are blocked
    if (data.accessToken) {
      saveToken(data.accessToken);
    }

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
