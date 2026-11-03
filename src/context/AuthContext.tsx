import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types/index.ts';
import { safeFetchJson } from '../utils/api.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  demoLogin: (role?: 'alex' | 'sarah' | 'marcus') => Promise<boolean>;
  logout: () => void;
  register: (name: string, email: string, password: string, title?: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthResponse {
  user: User;
  token: string;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('kb_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      const storedToken = localStorage.getItem('kb_token');
      if (!storedToken) {
        if (active) setIsLoading(false);
        return;
      }

      const response = await safeFetchJson<{ user: User }>('/api/auth/me');
      if (!active) return;

      if (response.ok && response.data?.user) {
        setUser(response.data.user);
        setToken(storedToken);
      } else {
        localStorage.removeItem('kb_token');
        setToken(null);
      }
      setIsLoading(false);
    }

    void checkAuth();
    return () => {
      active = false;
    };
  }, []);

  const establishSession = (data: AuthResponse) => {
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('kb_token', data.token);
  };

  const login = async (email: string, password: string) => {
    const response = await safeFetchJson<AuthResponse>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok || !response.data?.token || !response.data.user) return false;
    establishSession(response.data);
    return true;
  };

  const demoLogin = async (role: 'alex' | 'sarah' | 'marcus' = 'alex') => {
    const response = await safeFetchJson<AuthResponse>('/api/auth/demo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });

    if (!response.ok || !response.data?.token || !response.data.user) return false;
    establishSession(response.data);
    return true;
  };

  const register = async (name: string, email: string, password: string, title?: string) => {
    const response = await safeFetchJson<AuthResponse>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, title }),
    });

    if (!response.ok || !response.data?.token || !response.data.user) return false;
    establishSession(response.data);
    return true;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('kb_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, demoLogin, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
