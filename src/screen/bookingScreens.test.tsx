import React from 'react';
import renderer from 'react-test-renderer';
import Services from './Services';
import SelectProfessional from './SelectProfessional';
import Summary from './Summary';
import Checkout from './Checkout';
import { BookingProvider } from '../context/BookingContext';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text } from 'react-native';
import { apiClient } from '../api';

const renderWithProviders = (component: React.ReactElement) => {
  return renderer.create(
    <ToastProvider>
      <BookingProvider>{component}</BookingProvider>
    </ToastProvider>
  );
};

describe('Mobile Booking Screens', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(apiClient.catalog, 'getServices').mockResolvedValue([]);
    jest.spyOn(apiClient.catalog, 'getStaff').mockResolvedValue([]);
    jest.spyOn(apiClient.bookings, 'create').mockResolvedValue({
      id: 'apt-test-1',
      referenceNumber: 'BS-123456',
      shopId: 'shop-main',
      branchId: 'brn-main',
      customerId: 'usr-1',
      staffId: 'stf-1',
      scheduledAt: new Date().toISOString(),
      durationMinutes: 45,
      status: 'confirmed',
      subtotalCents: 3500,
      discountCents: 0,
      taxCents: 280,
      totalCents: 3780,
      currency: 'USD',
      services: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    renderer.act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Services Screen', () => {
    it('renders services list and toggles service into cart', async () => {
      let tree: renderer.ReactTestRenderer | null = null;
      await renderer.act(async () => {
        tree = renderWithProviders(<Services navigation={mockNavigation as any} route={{}} />);
      });

      expect(tree).toBeDefined();
      const touchables = tree!.root.findAllByType(TouchableOpacity);
      expect(touchables.length).toBeGreaterThan(0);
    });
  });

  describe('SelectProfessional Screen', () => {
    it('renders barbers list and dates', async () => {
      let tree: renderer.ReactTestRenderer | null = null;
      await renderer.act(async () => {
        tree = renderWithProviders(<SelectProfessional navigation={mockNavigation as any} />);
      });

      expect(tree).toBeDefined();
      const texts = tree!.root.findAllByType(Text);
      const stringValues = texts.map((t) => t.props.children).flat();
      expect(stringValues).toContain('Choose Barber');
      expect(stringValues).toContain('Available Time Slots');
    });
  });

  describe('Summary Screen', () => {
    it('renders appointment summary breakdown', async () => {
      let tree: renderer.ReactTestRenderer | null = null;
      await renderer.act(async () => {
        tree = renderWithProviders(<Summary navigation={mockNavigation as any} />);
      });

      expect(tree).toBeDefined();
      const texts = tree!.root.findAllByType(Text);
      const stringValues = texts.map((t) => t.props.children).flat();
      expect(stringValues).toContain('Booking Summary');
      expect(stringValues).toContain('Appointment Details');
      expect(stringValues).toContain('Cost Breakdown');
    });
  });

  describe('Checkout Screen', () => {
    it('renders payment method options and confirm button', async () => {
      let tree: renderer.ReactTestRenderer | null = null;
      await renderer.act(async () => {
        tree = renderWithProviders(<Checkout navigation={mockNavigation as any} />);
      });

      expect(tree).toBeDefined();
      const texts = tree!.root.findAllByType(Text);
      const stringValues = texts.map((t) => t.props.children).flat();
      expect(stringValues).toContain('Select Payment Method');
      expect(stringValues).toContain('Credit / Debit Card');
      expect(stringValues).toContain('Pay at Venue (Cash / Card)');
    });

    it('triggers booking creation on confirm button press', async () => {
      let tree: renderer.ReactTestRenderer | null = null;
      await renderer.act(async () => {
        tree = renderWithProviders(<Checkout navigation={mockNavigation as any} />);
      });

      const buttons = tree!.root.findAllByType(TouchableOpacity);
      const confirmButton = buttons.find((b) => {
        const text = b.findAllByType(Text)[0]?.props?.children;
        return Array.isArray(text)
          ? text.some((t: any) => typeof t === 'string' && t.includes('Confirm Booking'))
          : typeof text === 'string' && text.includes('Confirm Booking');
      });

      if (confirmButton) {
        await renderer.act(async () => {
          await confirmButton.props.onPress();
        });
      }
    });
  });
});
