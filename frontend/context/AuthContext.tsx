
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  setUserState: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1) URL fragment/query에 token 이 있으면 저장 후 제거
    const url = new URL(window.location.href);
    const searchToken = url.searchParams.get('token');

    let hashToken: string | null = null;
    let cleanedHash = '';
    if (window.location.hash) {
      // "#/?token=..." 또는 "#token=..." 모두 처리
      let hash = window.location.hash.substring(1); // remove '#'
      if (hash.startsWith('/')) hash = hash.substring(1);
      if (hash.startsWith('?')) hash = hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      hashToken = hashParams.get('token');
      hashParams.delete('token');
      cleanedHash = hashParams.toString();
    }

    const tokenFromUrl = searchToken || hashToken;
    if (tokenFromUrl) {
      localStorage.setItem('codeme_jwt', tokenFromUrl);
      document.cookie = `codeme_jwt=${encodeURIComponent(tokenFromUrl)}; path=/`;
      authService.restoreToken(); // sync api client
      // URL 정리
      url.searchParams.delete('token');
      const newSearch = url.searchParams.toString();
      const hashPart = cleanedHash ? `#/?${cleanedHash}` : '';
      history.replaceState(null, '', `${url.pathname}${newSearch ? `?${newSearch}` : ''}${hashPart}`);
    }

    // 2) 토큰이 있으면 /me 조회
    const savedToken = authService.restoreToken();
    if (!savedToken) {
      setIsLoading(false);
      return;
    }
    authService
      .me()
      .then((u) => setUser(u))
      .catch(() => authService.logout())
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const u = await authService.login(email, password);
    setUser(u);
  };

  const signup = async (email: string, password: string, name: string) => {
    const u = await authService.signup(email, password, name);
    setUser(u);
  };

  const loginWithGoogle = async () => {
    await authService.loginWithGoogle();
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    // Clear any in-memory chat state via reload to ensure messages disappear immediately
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, loginWithGoogle, logout, isLoading, setUserState: setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
