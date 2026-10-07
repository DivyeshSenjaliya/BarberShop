import { ApiClient, ApiError } from './client';

describe('ApiClient', () => {
  let client: ApiClient;
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = mockFetch;
    client = new ApiClient('https://api.barbershop.test/api/v1');
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('configures baseUrl correctly removing trailing slashes', () => {
    expect(client.getBaseUrl()).toBe('https://api.barbershop.test/api/v1');
    client.setBaseUrl('https://custom.barber.io///');
    expect(client.getBaseUrl()).toBe('https://custom.barber.io');
  });

  it('sends authorization header when tokens are set and requiresAuth is true', async () => {
    client.setTokens({
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      expiresIn: 3600,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({ data: { id: 'usr-1', email: 'test@example.com' } }),
    });

    const user = await client.auth.me();
    expect(user.id).toBe('usr-1');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.barbershop.test/api/v1/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-123',
        }),
      })
    );
  });

  it('throws ApiError with structured details on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        error: {
          code: 'SHOP_NOT_FOUND',
          message: 'The requested shop does not exist',
          status: 404,
        },
      }),
    });

    let caughtError: any = null;
    try {
      await client.catalog.getShop('nonexistent');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError.code).toBe('SHOP_NOT_FOUND');
    expect(caughtError.status).toBe(404);
    expect(caughtError.message).toBe('The requested shop does not exist');
  });

  it('refreshes token on 401 response and replays original request', async () => {
    client.setTokens({
      accessToken: 'expired-access',
      refreshToken: 'valid-refresh',
      expiresIn: 3600,
    });

    // 1st call: returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        error: { code: 'TOKEN_EXPIRED', message: 'Access token expired', status: 401 },
      }),
    });

    // 2nd call: /auth/refresh returns new tokens
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        data: {
          accessToken: 'fresh-access',
          refreshToken: 'fresh-refresh',
          expiresIn: 3600,
        },
      }),
    });

    // 3rd call: retried original request with fresh token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({ data: { id: 'apt-1', status: 'confirmed' } }),
    });

    const appointment = await client.bookings.get('apt-1');
    expect(appointment.id).toBe('apt-1');
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(client.getTokens()?.accessToken).toBe('fresh-access');
  });

  it('formats discovery search query parameters properly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({ data: [], meta: { total: 0 } }),
    });

    await client.discovery.searchShops({
      query: 'Gentlemen',
      latitude: 40.7128,
      longitude: -74.006,
      radiusKm: 15,
      sortBy: 'rating',
    });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('query=Gentlemen');
    expect(calledUrl).toContain('lat=40.7128');
    expect(calledUrl).toContain('lng=-74.006');
    expect(calledUrl).toContain('radiusKm=15');
    expect(calledUrl).toContain('sortBy=rating');
  });
});
