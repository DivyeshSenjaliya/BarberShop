import React from 'react';
import renderer from 'react-test-renderer';
import { BookingProvider, useBooking } from './BookingContext';
import type { Shop, Service, StaffMember, Slot } from '../api';
import { Text } from 'react-native';

describe('BookingContext', () => {
  const sampleShop: Shop = {
    id: 'shop-1',
    name: 'Precision Barbers',
    slug: 'precision-barbers',
    ownerId: 'usr-owner',
    status: 'active',
    ratingAverage: 4.8,
    reviewCount: 42,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const serviceA: Service = {
    id: 'srv-1',
    shopId: 'shop-1',
    name: 'Classic Fade',
    durationMinutes: 30,
    priceCents: 3500, // $35.00
    currency: 'USD',
    status: 'active',
  };

  const serviceB: Service = {
    id: 'srv-2',
    shopId: 'shop-1',
    name: 'Beard Trim & Hot Towel',
    durationMinutes: 20,
    priceCents: 2000, // $20.00
    currency: 'USD',
    status: 'active',
  };

  const sampleStaff: StaffMember = {
    id: 'stf-1',
    shopId: 'shop-1',
    userId: 'usr-barber',
    role: 'master_barber',
    commissionBps: 6000,
    status: 'active',
    ratingAverage: 4.9,
    reviewCount: 30,
    firstName: 'Marcus',
    lastName: 'Vance',
  };

  const sampleSlot: Slot = {
    startTime: '2026-10-15T10:00:00.000Z',
    endTime: '2026-10-15T10:50:00.000Z',
    staffId: 'stf-1',
    staffName: 'Marcus Vance',
  };

  it('selects shop and toggles multiple services with dynamic duration and pricing', () => {
    let booking: any = null;

    const TestConsumer = () => {
      booking = useBooking();
      return <Text>Booking Consumer</Text>;
    };

    renderer.act(() => {
      renderer.create(
        <BookingProvider>
          <TestConsumer />
        </BookingProvider>
      );
    });

    expect(booking.shop).toBeNull();
    expect(booking.pricing.totalCents).toBe(0);

    // Select shop
    renderer.act(() => {
      booking.setShop(sampleShop);
    });
    expect(booking.shop.id).toBe('shop-1');

    // Add first service
    renderer.act(() => {
      booking.toggleService(serviceA);
    });
    expect(booking.services).toHaveLength(1);
    expect(booking.pricing.durationMinutes).toBe(30);
    expect(booking.pricing.subtotalCents).toBe(3500);

    // Add second service
    renderer.act(() => {
      booking.toggleService(serviceB);
    });
    expect(booking.services).toHaveLength(2);
    expect(booking.pricing.durationMinutes).toBe(50);
    expect(booking.pricing.subtotalCents).toBe(5500); // $55.00
    // Tax = round(5500 * 0.08) = 440 cents ($4.40)
    expect(booking.pricing.taxCents).toBe(440);
    expect(booking.pricing.totalCents).toBe(5940); // $59.40

    // Toggle service A off
    renderer.act(() => {
      booking.toggleService(serviceA);
    });
    expect(booking.services).toHaveLength(1);
    expect(booking.services[0].id).toBe('srv-2');
    expect(booking.pricing.subtotalCents).toBe(2000);
  });

  it('calculates coupon discounts and loyalty point deductions accurately', () => {
    let booking: any = null;
    const TestConsumer = () => {
      booking = useBooking();
      return <Text>Pricing Consumer</Text>;
    };

    renderer.act(() => {
      renderer.create(
        <BookingProvider>
          <TestConsumer />
        </BookingProvider>
      );
    });

    renderer.act(() => {
      booking.setShop(sampleShop);
      booking.toggleService(serviceA); // $35.00
      booking.toggleService(serviceB); // $20.00 -> subtotal $55.00 (5500 cents)
    });

    // Apply $10 coupon (1000 cents)
    renderer.act(() => {
      booking.applyCoupon({
        id: 'cpn-1',
        code: 'SAVE10',
        type: 'fixed_amount',
        value: 1000,
        discountCents: 1000,
      });
    });

    expect(booking.pricing.discountCents).toBe(1000);
    // After coupon: 5500 - 1000 = 4500 taxable
    // Tax = round(4500 * 0.08) = 360
    // Total = 4500 + 360 = 4860 ($48.60)
    expect(booking.pricing.taxCents).toBe(360);
    expect(booking.pricing.totalCents).toBe(4860);

    // Redeem 500 loyalty points ($5.00 / 500 cents)
    renderer.act(() => {
      booking.setLoyaltyPoints(500);
    });
    expect(booking.pricing.loyaltyDiscountCents).toBe(500);
    // After loyalty: 5500 - 1000 - 500 = 4000 taxable
    // Tax = round(4000 * 0.08) = 320
    // Total = 4000 + 320 = 4320 ($43.20)
    expect(booking.pricing.taxCents).toBe(320);
    expect(booking.pricing.totalCents).toBe(4320);
  });

  it('handles slot, staff selection and resetBooking cleanly', () => {
    let booking: any = null;
    const TestConsumer = () => {
      booking = useBooking();
      return <Text>Flow Consumer</Text>;
    };

    renderer.act(() => {
      renderer.create(
        <BookingProvider>
          <TestConsumer />
        </BookingProvider>
      );
    });

    renderer.act(() => {
      booking.setShop(sampleShop);
      booking.setStaff(sampleStaff);
      booking.setDate('2026-10-15');
      booking.setSlot(sampleSlot);
      booking.setNotes('Leave hair longer on top, low taper fade please.');
    });

    expect(booking.staff.id).toBe('stf-1');
    expect(booking.slot.startTime).toBe('2026-10-15T10:00:00.000Z');
    expect(booking.notes).toContain('low taper fade');

    // Resetting clears all flow state
    renderer.act(() => {
      booking.resetBooking();
    });

    expect(booking.shop).toBeNull();
    expect(booking.staff).toBeNull();
    expect(booking.slot).toBeNull();
    expect(booking.services).toEqual([]);
    expect(booking.notes).toBe('');
    expect(booking.pricing.totalCents).toBe(0);
  });
});
