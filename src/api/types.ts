export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
    timestamp?: string;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    status: number;
    details?: unknown;
  };
}

// Auth Types
export interface SessionUser {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  role: 'customer' | 'barber' | 'shop_owner' | 'admin';
  status: 'active' | 'suspended' | 'deactivated';
  avatarUrl?: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: SessionUser;
  tokens: AuthTokens;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: 'customer' | 'barber' | 'shop_owner';
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Catalog Types
export interface Shop {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  ownerId: string;
  status: 'active' | 'inactive' | 'pending';
  phone?: string | null;
  email?: string | null;
  ratingAverage: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  shopId: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  isMainBranch: boolean;
}

export interface ServiceCategory {
  id: string;
  shopId: string;
  name: string;
  slug: string;
  displayOrder: number;
}

export interface Service {
  id: string;
  shopId: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  status: 'active' | 'inactive';
}

export interface StaffMember {
  id: string;
  shopId: string;
  branchId?: string | null;
  userId: string;
  role: 'barber' | 'senior_barber' | 'master_barber' | 'manager';
  title?: string | null;
  bio?: string | null;
  commissionBps: number;
  status: 'active' | 'on_leave' | 'inactive';
  ratingAverage: number;
  reviewCount: number;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
}

// Booking Types
export interface Slot {
  startTime: string; // ISO 8601 string
  endTime: string;
  staffId: string;
  staffName?: string;
}

export interface BookAppointmentRequest {
  shopId: string;
  branchId: string;
  staffId?: string;
  serviceIds: string[];
  scheduledAt: string;
  notes?: string;
  couponCode?: string;
  pointsToRedeem?: number;
}

export interface Appointment {
  id: string;
  referenceNumber: string;
  shopId: string;
  branchId: string;
  customerId: string;
  staffId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  notes?: string | null;
  services: Array<{
    serviceId: string;
    serviceName: string;
    durationMinutes: number;
    priceCents: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

// Growth Types
export interface CouponValidation {
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    type: 'percentage' | 'fixed_amount';
    value: number;
    discountCents: number;
    description?: string;
  };
  reason?: string;
}

export interface LoyaltyAccount {
  userId: string;
  pointsBalance: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  lifetimeEarned: number;
  lifetimeRedeemed: number;
}

export interface Review {
  id: string;
  bookingId?: string | null;
  shopId: string;
  staffId?: string | null;
  customerId: string;
  rating: number;
  comment?: string | null;
  ownerReply?: string | null;
  ownerReplyAt?: string | null;
  customerName?: string;
  createdAt: string;
}

export interface CreateReviewRequest {
  bookingId?: string;
  shopId: string;
  staffId?: string;
  rating: number;
  comment?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'booking' | 'payment' | 'promotion' | 'reminder' | 'system';
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Discovery Types
export interface DiscoveryShop extends Shop {
  branchCount: number;
  distanceKm?: number;
  featuredServices: Service[];
}

export interface DiscoveryBarber extends StaffMember {
  shopName: string;
  distanceKm?: number;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  minRating?: number;
  maxPriceCents?: number;
  sortBy?: 'distance' | 'rating' | 'price' | 'popular';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
