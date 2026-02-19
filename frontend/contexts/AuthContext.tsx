import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type User = {
  user_id: string;
  email: string;
  name: string;
  picture: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (sessionId: string) => Promise<User | null>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => null,
  logout: async () => {},
  checkAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const storedToken = await AsyncStorage.getItem('session_token');
      if (!storedToken) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const resp = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${storedToken}` },
        credentials: 'include',
      });
      if (resp.ok) {
        const userData = await resp.json();
        setUser(userData);
      } else {
        setUser(null);
        await AsyncStorage.removeItem('session_token');
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (sessionId: string): Promise<User | null> => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
        credentials: 'include',
      });
      if (!resp.ok) return null;
      const userData = await resp.json();
      
      // Store session token from response body (primary method)
      if (userData.session_token) {
        await AsyncStorage.setItem('session_token', userData.session_token);
      }
      
      // Fallback: try from cookie header
      if (!userData.session_token) {
        const cookies = resp.headers.get('set-cookie');
        if (cookies) {
          const tokenMatch = cookies.match(/session_token=([^;]+)/);
          if (tokenMatch) {
            await AsyncStorage.setItem('session_token', tokenMatch[1]);
          }
        }
      }
      
      setUser(userData);
      return userData;
    } catch {
      return null;
    }
  };

  const logout = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('session_token');
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers: storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {},
        credentials: 'include',
      });
    } catch { /* ignore */ }
    await AsyncStorage.removeItem('session_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
