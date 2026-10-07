import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Shop, Branch, Service, StaffMember, Slot, CouponValidation } from '../api';

export interface BookingState {
  shop: Shop | null;
  branch: Branch | null;
  services: Service[];
  staff: StaffMember | null;
  date: string | null;
  slot: Slot | null;
  coupon: CouponValidation['coupon'] | null;
  loyaltyPointsToRedeem: number;
  notes: string;
}

export interface BookingPricing {
  durationMinutes: number;
  subtotalCents: number;
  discountCents: number;
  loyaltyDiscountCents: number;
  taxCents: number;
  totalCents: number;
}

export interface BookingContextValue extends BookingState {
  pricing: BookingPricing;
  setShop: (shop: Shop, branch?: Branch | null) => void;
  setBranch: (branch: Branch | null) => void;
  toggleService: (service: Service) => void;
  removeService: (serviceId: string) => void;
  clearServices: () => void;
  setStaff: (staff: StaffMember | null) => void;
  setDate: (date: string | null) => void;
  setSlot: (slot: Slot | null) => void;
  applyCoupon: (coupon: CouponValidation['coupon'] | null) => void;
  setLoyaltyPoints: (points: number) => void;
  setNotes: (notes: string) => void;
  resetBooking: () => void;
}

const TAX_RATE = 0.08; // 8% standard tax
const CENTS_PER_LOYALTY_POINT = 1; // 100 points = $1.00

const BookingContext = createContext<BookingContextValue | undefined>(undefined);

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shop, setShopState] = useState<Shop | null>(null);
  const [branch, setBranchState] = useState<Branch | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaffState] = useState<StaffMember | null>(null);
  const [date, setDateState] = useState<string | null>(null);
  const [slot, setSlotState] = useState<Slot | null>(null);
  const [coupon, setCouponState] = useState<CouponValidation['coupon'] | null>(null);
  const [loyaltyPointsToRedeem, setLoyaltyPointsState] = useState<number>(0);
  const [notes, setNotesState] = useState<string>('');

  const setShop = useCallback((newShop: Shop, newBranch?: Branch | null) => {
    setShopState(newShop);
    if (newBranch !== undefined) {
      setBranchState(newBranch);
    }
  }, []);

  const setBranch = useCallback((newBranch: Branch | null) => {
    setBranchState(newBranch);
  }, []);

  const toggleService = useCallback((service: Service) => {
    setServices((prev) => {
      const exists = prev.some((s) => s.id === service.id);
      if (exists) {
        return prev.filter((s) => s.id !== service.id);
      }
      return [...prev, service];
    });
  }, []);

  const removeService = useCallback((serviceId: string) => {
    setServices((prev) => prev.filter((s) => s.id !== serviceId));
  }, []);

  const clearServices = useCallback(() => {
    setServices([]);
  }, []);

  const setStaff = useCallback((newStaff: StaffMember | null) => {
    setStaffState(newStaff);
    setSlotState(null); // Clear slot if staff changes
  }, []);

  const setDate = useCallback((newDate: string | null) => {
    setDateState(newDate);
    setSlotState(null); // Clear slot if date changes
  }, []);

  const setSlot = useCallback((newSlot: Slot | null) => {
    setSlotState(newSlot);
  }, []);

  const applyCoupon = useCallback((newCoupon: CouponValidation['coupon'] | null) => {
    setCouponState(newCoupon);
  }, []);

  const setLoyaltyPoints = useCallback((points: number) => {
    setLoyaltyPointsState(Math.max(0, points));
  }, []);

  const setNotes = useCallback((newNotes: string) => {
    setNotesState(newNotes);
  }, []);

  const resetBooking = useCallback(() => {
    setShopState(null);
    setBranchState(null);
    setServices([]);
    setStaffState(null);
    setDateState(null);
    setSlotState(null);
    setCouponState(null);
    setLoyaltyPointsState(0);
    setNotesState('');
  }, []);

  const pricing = useMemo<BookingPricing>(() => {
    const durationMinutes = services.reduce((acc, s) => acc + s.durationMinutes, 0);
    const subtotalCents = services.reduce((acc, s) => acc + s.priceCents, 0);

    let discountCents = 0;
    if (coupon) {
      discountCents = Math.min(coupon.discountCents, subtotalCents);
    }

    const maxLoyaltyDiscount = Math.max(0, subtotalCents - discountCents);
    const loyaltyDiscountCents = Math.min(
      loyaltyPointsToRedeem * CENTS_PER_LOYALTY_POINT,
      maxLoyaltyDiscount
    );

    const taxableAmount = Math.max(0, subtotalCents - discountCents - loyaltyDiscountCents);
    const taxCents = Math.round(taxableAmount * TAX_RATE);
    const totalCents = taxableAmount + taxCents;

    return {
      durationMinutes,
      subtotalCents,
      discountCents,
      loyaltyDiscountCents,
      taxCents,
      totalCents,
    };
  }, [services, coupon, loyaltyPointsToRedeem]);

  const value = useMemo<BookingContextValue>(
    () => ({
      shop,
      branch,
      services,
      staff,
      date,
      slot,
      coupon,
      loyaltyPointsToRedeem,
      notes,
      pricing,
      setShop,
      setBranch,
      toggleService,
      removeService,
      clearServices,
      setStaff,
      setDate,
      setSlot,
      applyCoupon,
      setLoyaltyPoints,
      setNotes,
      resetBooking,
    }),
    [
      shop,
      branch,
      services,
      staff,
      date,
      slot,
      coupon,
      loyaltyPointsToRedeem,
      notes,
      pricing,
      setShop,
      setBranch,
      toggleService,
      removeService,
      clearServices,
      setStaff,
      setDate,
      setSlot,
      applyCoupon,
      setLoyaltyPoints,
      setNotes,
      resetBooking,
    ]
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};

export const useBooking = (): BookingContextValue => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};
