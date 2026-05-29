import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  postingApproved?: boolean;
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
  // Track whether we're still in the initial load phase so we don't
  // misinterpret cold-start 401s as genuine session-expired events.
  const initialLoadDone = useRef(false);

  const logout = useCallback(async () => {
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
    // Auth is cookie-based. Retry up to 5 times with backoff to handle
    // Render free-tier cold starts (backend can take 30–60 s to wake up).
    const MAX_RETRIES = 5;
    const BACKOFF_MS = [2000, 4000, 6000, 8000, 10000];

    // Give warmUpBackend a head start on the very first load
    if (!initialLoadDone.current) {
      await new Promise(res => setTimeout(res, 800));
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data } = await api.get('auth/profile');
        setUser(data.user);
        if (data.student) setStudent(data.student);
        setLoading(false);
        initialLoadDone.current = true;
        return;
      } catch (err: any) {
        const status = err.response?.status;

        if (status === 401) {
          // On very first attempt, a 401 could be a cold-start race where the
          // server just woke up but the cookie wasn't re-sent correctly yet.
          // Retry once before giving up.
          if (!initialLoadDone.current && attempt === 0) {
            await new Promise(res => setTimeout(res, BACKOFF_MS[0]));
            continue;
          }
          // Genuine auth failure — no valid cookie
          setUser(null);
          setStudent(null);
          setLoading(false);
          initialLoadDone.current = true;
          return;
        }

        // Network error or 5xx — backend may be waking up
        if (attempt < MAX_RETRIES) {
          await new Promise(res => setTimeout(res, BACKOFF_MS[attempt]));
        } else {
          // All retries exhausted
          setUser(null);
          setStudent(null);
          setLoading(false);
          initialLoadDone.current = true;
        }
      }
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Listen for 401 events dispatched by the axios interceptor.
  // Only handle after the initial load completes so cold-start races don't
  // trigger premature logout.
  useEffect(() => {
    const handler = () => {
      if (initialLoadDone.current) {
        logout();
      }
    };
    window.addEventListener('acetel:session-expired', handler);
    return () => window.removeEventListener('acetel:session-expired', handler);
  }, [logout]);

  const login = async (identifier: string, password: string) => {
    const { data } = await api.post('auth/login', { identifier, password });
    setAuthToken(data.accessToken || null, data.refreshToken || null);
    setUser(data.user);
    if (data.student) setStudent(data.student);
    initialLoadDone.current = true;
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
