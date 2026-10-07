import React from 'react';
import renderer from 'react-test-renderer';
import { AuthProvider, useAuth } from './AuthContext';
import { apiClient } from '../api';
import { Text } from 'react-native';

describe('AuthContext', () => {
  const mockUser = {
    id: 'usr-1',
    email: 'client@example.com',
    firstName: 'Alex',
    lastName: 'Morgan',
    role: 'customer' as const,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
  };

  const mockTokens = {
    accessToken: 'mock-access',
    refreshToken: 'mock-refresh',
    expiresIn: 3600,
  };

  afterEach(() => {
    jest.restoreAllMocks();
    apiClient.clearTokens();
  });

  it('initializes with unauthenticated state when no initial data provided', () => {
    let authContext: any = null;

    const TestConsumer = () => {
      authContext = useAuth();
      return <Text>{authContext.isAuthenticated ? 'Logged In' : 'Logged Out'}</Text>;
    };

    renderer.act(() => {
      renderer.create(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(authContext.isAuthenticated).toBe(false);
    expect(authContext.user).toBeNull();
  });

  it('handles successful login and updates state', async () => {
    jest.spyOn(apiClient.auth, 'login').mockResolvedValueOnce({
      user: mockUser,
      tokens: mockTokens,
    });

    let authContext: any = null;
    const TestConsumer = () => {
      authContext = useAuth();
      return <Text>{authContext.user?.email || 'none'}</Text>;
    };

    renderer.act(() => {
      renderer.create(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    await renderer.act(async () => {
      await authContext.login({ email: 'client@example.com', password: 'Password123!' });
    });

    expect(authContext.isAuthenticated).toBe(true);
    expect(authContext.user.email).toBe('client@example.com');
    expect(authContext.tokens.accessToken).toBe('mock-access');
    expect(authContext.error).toBeNull();
  });

  it('records error message on login failure', async () => {
    jest.spyOn(apiClient.auth, 'login').mockRejectedValueOnce(new Error('Invalid credentials'));

    let authContext: any = null;
    const TestConsumer = () => {
      authContext = useAuth();
      return <Text>{authContext.error || ''}</Text>;
    };

    renderer.act(() => {
      renderer.create(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    await renderer.act(async () => {
      try {
        await authContext.login({ email: 'wrong@example.com', password: 'wrong' });
      } catch {
        // Expected throw
      }
    });

    expect(authContext.isAuthenticated).toBe(false);
    expect(authContext.error).toBe('Login failed. Please try again.');
  });

  it('resets state on logout', async () => {
    jest.spyOn(apiClient.auth, 'logout').mockResolvedValueOnce();

    let authContext: any = null;
    const TestConsumer = () => {
      authContext = useAuth();
      return <Text>{authContext.isAuthenticated ? 'Logged In' : 'Logged Out'}</Text>;
    };

    renderer.act(() => {
      renderer.create(
        <AuthProvider initialUser={mockUser} initialTokens={mockTokens}>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(authContext.isAuthenticated).toBe(true);

    await renderer.act(async () => {
      await authContext.logout();
    });

    expect(authContext.isAuthenticated).toBe(false);
    expect(authContext.user).toBeNull();
    expect(authContext.tokens).toBeNull();
  });
});
