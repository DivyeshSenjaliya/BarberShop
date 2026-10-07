import type {
  ApiResponse,
  ApiErrorResponse,
  AuthResponse,
  AuthTokens,
  RegisterRequest,
  LoginRequest,
  SessionUser,
  Shop,
  Branch,
  Service,
  StaffMember,
  Slot,
  BookAppointmentRequest,
  Appointment,
  CouponValidation,
  LoyaltyAccount,
  Review,
  CreateReviewRequest,
  NotificationItem,
  DiscoveryShop,
  DiscoveryBarber,
  SearchFilters,
} from './types';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, status: number, code: string = 'API_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export class ApiClient {
  private baseUrl: string;
  private tokens: AuthTokens | null = null;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string | null) => void> = [];

  constructor(baseUrl: string = 'http://localhost:3000/api/v1') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setTokens(tokens: AuthTokens | null): void {
    this.tokens = tokens;
  }

  public getTokens(): AuthTokens | null {
    return this.tokens;
  }

  public clearTokens(): void {
    this.tokens = null;
  }

  private onTokenRefreshed(newToken: string | null): void {
    this.refreshSubscribers.forEach((callback) => callback(newToken));
    this.refreshSubscribers = [];
  }

  private subscribeTokenRefresh(callback: (token: string | null) => void): void {
    this.refreshSubscribers.push(callback);
  }

  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { requiresAuth = true, headers: customHeaders, ...restOptions } = options;
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((customHeaders as Record<string, string>) || {}),
    };

    if (requiresAuth && this.tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${this.tokens.accessToken}`;
    }

    const response = await fetch(url, {
      ...restOptions,
      headers,
    });

    if (response.status === 401 && requiresAuth && this.tokens?.refreshToken) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const newTokens = await this.refreshToken();
          this.isRefreshing = false;
          this.onTokenRefreshed(newTokens.accessToken);

          headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
          const retryResponse = await fetch(url, { ...restOptions, headers });
          return this.handleResponse<T>(retryResponse);
        } catch (refreshErr) {
          this.isRefreshing = false;
          this.clearTokens();
          this.onTokenRefreshed(null);
          throw refreshErr;
        }
      } else {
        return new Promise<T>((resolve, reject) => {
          this.subscribeTokenRefresh(async (newToken) => {
            if (!newToken) {
              return reject(new ApiError('Session expired. Please log in again.', 401, 'UNAUTHORIZED'));
            }
            try {
              headers['Authorization'] = `Bearer ${newToken}`;
              const retryResponse = await fetch(url, { ...restOptions, headers });
              resolve(await this.handleResponse<T>(retryResponse));
            } catch (err) {
              reject(err);
            }
          });
        });
      }
    }

    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      const errorData = data as ApiErrorResponse | null;
      const message = errorData?.error?.message || `Request failed with status ${response.status}`;
      const code = errorData?.error?.code || 'HTTP_ERROR';
      const details = errorData?.error?.details;
      throw new ApiError(message, response.status, code, details);
    }

    return data as T;
  }

  private async refreshToken(): Promise<AuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new ApiError('No refresh token available', 401, 'UNAUTHORIZED');
    }

    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
    });

    if (!response.ok) {
      throw new ApiError('Failed to refresh authentication token', 401, 'TOKEN_EXPIRED');
    }

    const result = (await response.json()) as ApiResponse<AuthTokens>;
    this.tokens = result.data;
    return result.data;
  }

  // --- Auth Domain ---
  public auth = {
    register: async (req: RegisterRequest): Promise<AuthResponse> => {
      const res = await this.request<ApiResponse<AuthResponse>>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(req),
        requiresAuth: false,
      });
      this.setTokens(res.data.tokens);
      return res.data;
    },

    login: async (req: LoginRequest): Promise<AuthResponse> => {
      const res = await this.request<ApiResponse<AuthResponse>>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(req),
        requiresAuth: false,
      });
      this.setTokens(res.data.tokens);
      return res.data;
    },

    logout: async (): Promise<void> => {
      if (this.tokens?.accessToken) {
        try {
          await this.request('/auth/logout', { method: 'POST' });
        } catch {
          // Ignore logout error on server, clear locally
        }
      }
      this.clearTokens();
    },

    me: async (): Promise<SessionUser> => {
      const res = await this.request<ApiResponse<SessionUser>>('/auth/me');
      return res.data;
    },
  };

  // --- Catalog Domain ---
  public catalog = {
    getShop: async (shopId: string): Promise<Shop> => {
      const res = await this.request<ApiResponse<Shop>>(`/catalog/shops/${shopId}`, {
        requiresAuth: false,
      });
      return res.data;
    },

    getBranches: async (shopId: string): Promise<Branch[]> => {
      const res = await this.request<ApiResponse<Branch[]>>(`/catalog/shops/${shopId}/branches`, {
        requiresAuth: false,
      });
      return res.data;
    },

    getServices: async (shopId: string): Promise<Service[]> => {
      const res = await this.request<ApiResponse<Service[]>>(`/catalog/shops/${shopId}/services`, {
        requiresAuth: false,
      });
      return res.data;
    },

    getStaff: async (shopId: string): Promise<StaffMember[]> => {
      const res = await this.request<ApiResponse<StaffMember[]>>(`/catalog/shops/${shopId}/staff`, {
        requiresAuth: false,
      });
      return res.data;
    },
  };

  // --- Discovery Domain ---
  public discovery = {
    searchShops: async (filters: SearchFilters = {}): Promise<ApiResponse<DiscoveryShop[]>> => {
      const params = new URLSearchParams();
      if (filters.query) params.append('query', filters.query);
      if (filters.category) params.append('category', filters.category);
      if (filters.latitude != null) params.append('lat', String(filters.latitude));
      if (filters.longitude != null) params.append('lng', String(filters.longitude));
      if (filters.radiusKm) params.append('radiusKm', String(filters.radiusKm));
      if (filters.minRating) params.append('minRating', String(filters.minRating));
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      return this.request<ApiResponse<DiscoveryShop[]>>(`/discovery/shops${queryStr}`, {
        requiresAuth: false,
      });
    },

    searchBarbers: async (filters: SearchFilters = {}): Promise<ApiResponse<DiscoveryBarber[]>> => {
      const params = new URLSearchParams();
      if (filters.query) params.append('query', filters.query);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      return this.request<ApiResponse<DiscoveryBarber[]>>(`/discovery/barbers${queryStr}`, {
        requiresAuth: false,
      });
    },
  };

  // --- Booking Domain ---
  public bookings = {
    getAvailability: async (params: {
      shopId: string;
      staffId?: string;
      date: string;
      durationMinutes: number;
    }): Promise<Slot[]> => {
      const query = new URLSearchParams({
        shopId: params.shopId,
        date: params.date,
        durationMinutes: String(params.durationMinutes),
      });
      if (params.staffId) query.append('staffId', params.staffId);

      const res = await this.request<ApiResponse<Slot[]>>(`/bookings/availability?${query.toString()}`, {
        requiresAuth: false,
      });
      return res.data;
    },

    create: async (req: BookAppointmentRequest): Promise<Appointment> => {
      const res = await this.request<ApiResponse<Appointment>>('/bookings', {
        method: 'POST',
        body: JSON.stringify(req),
      });
      return res.data;
    },

    get: async (appointmentId: string): Promise<Appointment> => {
      const res = await this.request<ApiResponse<Appointment>>(`/bookings/${appointmentId}`);
      return res.data;
    },

    listMine: async (params?: { status?: string; page?: number }): Promise<ApiResponse<Appointment[]>> => {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.page) query.append('page', String(params.page));

      const qs = query.toString() ? `?${query.toString()}` : '';
      return this.request<ApiResponse<Appointment[]>>(`/bookings/my${qs}`);
    },

    cancel: async (appointmentId: string, reason?: string): Promise<Appointment> => {
      const res = await this.request<ApiResponse<Appointment>>(`/bookings/${appointmentId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      return res.data;
    },

    reschedule: async (appointmentId: string, scheduledAt: string): Promise<Appointment> => {
      const res = await this.request<ApiResponse<Appointment>>(`/bookings/${appointmentId}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ scheduledAt }),
      });
      return res.data;
    },
  };

  // --- Growth Domain (Coupons, Loyalty, Reviews, Favorites, Notifications) ---
  public promotions = {
    validateCoupon: async (params: {
      code: string;
      orderAmountCents: number;
      shopId?: string;
      serviceIds?: string[];
    }): Promise<CouponValidation> => {
      const res = await this.request<ApiResponse<CouponValidation>>('/coupons/validate', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return res.data;
    },
  };

  public loyalty = {
    getAccount: async (): Promise<LoyaltyAccount> => {
      const res = await this.request<ApiResponse<LoyaltyAccount>>('/loyalty/me');
      return res.data;
    },
  };

  public reviews = {
    listForShop: async (shopId: string, page = 1): Promise<ApiResponse<Review[]>> => {
      return this.request<ApiResponse<Review[]>>(`/reviews?shopId=${shopId}&page=${page}`, {
        requiresAuth: false,
      });
    },

    create: async (req: CreateReviewRequest): Promise<Review> => {
      const res = await this.request<ApiResponse<Review>>('/reviews', {
        method: 'POST',
        body: JSON.stringify(req),
      });
      return res.data;
    },
  };

  public favorites = {
    list: async (): Promise<string[]> => {
      const res = await this.request<ApiResponse<string[]>>('/favorites');
      return res.data;
    },

    toggle: async (targetType: 'shop' | 'barber', targetId: string): Promise<{ favorited: boolean }> => {
      const res = await this.request<ApiResponse<{ favorited: boolean }>>('/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId }),
      });
      return res.data;
    },
  };

  public notifications = {
    list: async (): Promise<NotificationItem[]> => {
      const res = await this.request<ApiResponse<NotificationItem[]>>('/notifications');
      return res.data;
    },

    markAsRead: async (id: string): Promise<void> => {
      await this.request(`/notifications/${id}/read`, { method: 'POST' });
    },
  };
}

export const apiClient = new ApiClient();
