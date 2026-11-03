import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.ts';
import { safeFetchJson } from '../utils/api.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  demoLogin: (role?: 'alex' | 'sarah' | 'marcus') => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => void;
  register: (name: string, email: string, password: string, title?: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('kb_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkAuth() {
      const storedToken = localStorage.getItem('kb_token');
      if (storedToken) {
        const meRes = await safeFetchJson<{ user: User }>('/api/auth/me');
        if (meRes.ok && meRes.data?.user) {
          setUser(meRes.data.user);
          setToken(storedToken);
          setIsLoading(false);
          return;
        }
      }
      
      // Auto-authenticate as default demo user for seamless hackathon judge testing
      const demoRes = await safeFetchJson<{ user: User; token: string }>('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'alex' }),
      });

      if (demoRes.ok && demoRes.data) {
        setUser(demoRes.data.user);
        setToken(demoRes.data.token);
        localStorage.setItem('kb_token', demoRes.data.token);
      }
      setIsLoading(false);
    }

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('kb_token', data.token);
      return true;
    } catch {
      return false;
    }
  };

  const demoLogin = async (role: 'alex' | 'sarah' | 'marcus' = 'alex') => {
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('kb_token', data.token);
      return true;
    } catch {
      return false;
    }
  };

  const register = async (name: string, email: string, password: string, title?: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, title }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('kb_token', data.token);
      return true;
    } catch {
      return false;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const { signInWithPopup } = await import('firebase/auth');
      const { auth, googleProvider } = await import('../firebase/config.ts');
      const cred = await signInWithPopup(auth, googleProvider);
      const googleUser = cred.user;
      if (googleUser) {
        const u: User = {
          id: googleUser.uid,
          name: googleUser.displayName || 'Authorized Google User',
          email: googleUser.email || 'user@google.com',
          role: 'LEAD',
          title: 'Project Lead (Google Verified)',
          avatarUrl: googleUser.photoURL || undefined,
          createdAt: new Date().toISOString(),
        };
        setUser(u);
        const fbToken = `firebase-${googleUser.uid}`;
        setToken(fbToken);
        localStorage.setItem('kb_token', fbToken);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Firebase Google Sign-In error:', err);
      return false;
    }
  };

  const logout = async () => {
    try {
      const { signOut } = await import('firebase/auth');
      const { auth } = await import('../firebase/config.ts');
      await signOut(auth);
    } catch {}
    setUser(null);
    setToken(null);
    localStorage.removeItem('kb_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, demoLogin, loginWithGoogle, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
