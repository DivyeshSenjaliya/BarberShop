import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { apiClient, ApiError } from '../api';
import type { SessionUser, AuthTokens, LoginRequest, RegisterRequest } from '../api';

export interface AuthContextValue {
  user: SessionUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (req: LoginRequest) => Promise<void>;
  register: (req: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: SessionUser | null;
  initialTokens?: AuthTokens | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  initialUser = null,
  initialTokens = null,
}) => {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [tokens, setTokens] = useState<AuthTokens | null>(() => {
    if (initialTokens) {
      apiClient.setTokens(initialTokens);
    }
    return initialTokens;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const login = useCallback(async (req: LoginRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.auth.login(req);
      setUser(response.user);
      setTokens(response.tokens);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Login failed. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (req: RegisterRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.auth.register(req);
      setUser(response.user);
      setTokens(response.tokens);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Registration failed. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiClient.auth.logout();
    } finally {
      setUser(null);
      setTokens(null);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokens) return;
    try {
      const currentUser = await apiClient.auth.me();
      setUser(currentUser);
    } catch {
      // Keep existing user if transient network error
    }
  }, [tokens]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      tokens,
      isAuthenticated: Boolean(user && tokens?.accessToken),
      isLoading,
      error,
      login,
      register,
      logout,
      refreshUser,
      clearError,
    }),
    [user, tokens, isLoading, error, login, register, logout, refreshUser, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
