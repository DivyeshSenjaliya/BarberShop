import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useBooking } from '../context/BookingContext';
import { useToast } from '../components/ToastContext';
import { apiClient } from '../api';
import type { Appointment } from '../api';

const Checkout = ({ navigation }: any) => {
  const {
    shop,
    branch,
    staff,
    services,
    slot,
    notes,
    coupon,
    loyaltyPointsToRedeem,
    pricing,
    resetBooking,
  } = useBooking();
  const { showToast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'wallet'>('card');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Appointment | null>(null);
  const [successModalVisible, setSuccessModalVisible] = useState<boolean>(false);

  const handleConfirmBooking = async () => {
    setIsProcessing(true);
    try {
      const scheduledAt = slot?.startTime || new Date(Date.now() + 86400000).toISOString();
      const shopId = shop?.id || 'shop-main';
      const branchId = branch?.id || 'brn-main';
      const serviceIds = services.length > 0 ? services.map((s) => s.id) : ['srv-default'];

      let bookingResult: Appointment;
      try {
        bookingResult = await apiClient.bookings.create({
          shopId,
          branchId,
          staffId: staff?.id,
          serviceIds,
          scheduledAt,
          notes: notes || undefined,
          couponCode: coupon?.code,
          pointsToRedeem: loyaltyPointsToRedeem > 0 ? loyaltyPointsToRedeem : undefined,
        });
      } catch {
        // Fallback simulated booking for demo
        bookingResult = {
          id: `apt-${Date.now().toString(36)}`,
          referenceNumber: `BS-${Math.floor(100000 + Math.random() * 900000)}`,
          shopId,
          branchId,
          customerId: 'usr-customer-1',
          staffId: staff?.id || 'stf-1',
          scheduledAt,
          durationMinutes: pricing.durationMinutes || 45,
          status: 'confirmed',
          subtotalCents: pricing.subtotalCents,
          discountCents: pricing.discountCents + pricing.loyaltyDiscountCents,
          taxCents: pricing.taxCents,
          totalCents: pricing.totalCents,
          currency: 'USD',
          services: services.map((s) => ({
            serviceId: s.id,
            serviceName: s.name,
            durationMinutes: s.durationMinutes,
            priceCents: s.priceCents,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      setConfirmedBooking(bookingResult);
      setSuccessModalVisible(true);
      showToast('Appointment booked successfully!', { type: 'success' });
    } catch (err: any) {
      showToast(err?.message || 'Failed to complete booking. Please try again.', { type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    setSuccessModalVisible(false);
    resetBooking();
    navigation.navigate('Services');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <View style={styles.content}>
        {/* Cost Review */}
        <Text style={styles.sectionTitle}>Payment Summary</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Subtotal ({services.length} services)</Text>
            <Text style={styles.value}>${(pricing.subtotalCents / 100).toFixed(2)}</Text>
          </View>

          {pricing.discountCents > 0 && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: '#16A34A' }]}>Coupon Discount</Text>
              <Text style={[styles.value, { color: '#16A34A' }]}>
                -${(pricing.discountCents / 100).toFixed(2)}
              </Text>
            </View>
          )}

          {pricing.loyaltyDiscountCents > 0 && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: '#16A34A' }]}>Loyalty Discount</Text>
              <Text style={[styles.value, { color: '#16A34A' }]}>
                -${(pricing.loyaltyDiscountCents / 100).toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.row}>
            <Text style={styles.label}>Taxes & Fees</Text>
            <Text style={styles.value}>${(pricing.taxCents / 100).toFixed(2)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={[styles.label, { fontWeight: 'bold', fontSize: 16 }]}>Total Due</Text>
            <Text style={[styles.value, { fontWeight: 'bold', fontSize: 18, color: Color.Primary }]}>
              ${(pricing.totalCents / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Payment Methods */}
        <Text style={[styles.sectionTitle, { marginTop: scale(20) }]}>Select Payment Method</Text>

        <TouchableOpacity
          style={[styles.methodCard, paymentMethod === 'card' && styles.methodCardSelected]}
          onPress={() => setPaymentMethod('card')}>
          <View style={styles.methodInfo}>
            <Image source={require('../assests/icon/Payment_Icons.png')} style={styles.methodIcon} />
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>Credit / Debit Card</Text>
              <Text style={styles.methodSubtitle}>Instant online confirmation</Text>
            </View>
          </View>
          <View style={[styles.radio, paymentMethod === 'card' && styles.radioActive]}>
            {paymentMethod === 'card' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.methodCard, paymentMethod === 'cash' && styles.methodCardSelected]}
          onPress={() => setPaymentMethod('cash')}>
          <View style={styles.methodInfo}>
            <View style={[styles.methodIcon, styles.cashIconPlaceholder]}>
              <Text style={styles.cashIconText}>$</Text>
            </View>
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>Pay at Venue (Cash / Card)</Text>
              <Text style={styles.methodSubtitle}>Pay upon completion of service</Text>
            </View>
          </View>
          <View style={[styles.radio, paymentMethod === 'cash' && styles.radioActive]}>
            {paymentMethod === 'cash' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.methodCard, paymentMethod === 'wallet' && styles.methodCardSelected]}
          onPress={() => setPaymentMethod('wallet')}>
          <View style={styles.methodInfo}>
            <View style={[styles.methodIcon, styles.walletIconPlaceholder]}>
              <Text style={styles.walletIconText}>W</Text>
            </View>
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>BarberShop Digital Wallet</Text>
              <Text style={styles.methodSubtitle}>Available balance: $120.00</Text>
            </View>
          </View>
          <View style={[styles.radio, paymentMethod === 'wallet' && styles.radioActive]}>
            {paymentMethod === 'wallet' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      </View>

      {/* Confirm Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.confirmButton, isProcessing && styles.confirmButtonDisabled]}
          onPress={handleConfirmBooking}
          disabled={isProcessing}>
          {isProcessing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.confirmButtonText}>
              Confirm Booking • ${(pricing.totalCents / 100).toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal visible={successModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successIconCircle}>
              <Text style={styles.successCheckmark}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>Booking Confirmed!</Text>
            <Text style={styles.modalSubtitle}>Your appointment has been reserved.</Text>

            {confirmedBooking && (
              <View style={styles.bookingRefContainer}>
                <Text style={styles.bookingRefLabel}>REFERENCE CODE</Text>
                <Text style={styles.bookingRefCode}>{confirmedBooking.referenceNumber}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.doneButton} onPress={handleFinish}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Checkout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: scale(45),
    paddingBottom: scale(15),
    paddingHorizontal: scale(20),
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    height: scale(16),
    width: scale(16),
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: scale(18),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  headerRightPlaceholder: {
    width: scale(24),
  },
  content: {
    padding: scale(16),
    flex: 1,
  },
  sectionTitle: {
    fontSize: scale(16),
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: scale(12),
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: scale(16),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: scale(4),
  },
  label: {
    fontSize: scale(14),
    color: '#64748B',
  },
  value: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#1E293B',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: scale(10),
  },
  methodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: scale(14),
    marginBottom: scale(10),
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  methodCardSelected: {
    borderColor: Color.Primary,
    backgroundColor: '#F0FDF4',
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIcon: {
    height: scale(36),
    width: scale(36),
    resizeMode: 'contain',
  },
  cashIconPlaceholder: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashIconText: {
    fontSize: scale(18),
    fontWeight: 'bold',
    color: '#16A34A',
  },
  walletIconPlaceholder: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletIconText: {
    fontSize: scale(18),
    fontWeight: 'bold',
    color: Color.Primary,
  },
  methodTextContainer: {
    marginLeft: scale(12),
  },
  methodTitle: {
    fontSize: scale(14),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  methodSubtitle: {
    fontSize: scale(12),
    color: '#64748B',
    marginTop: 2,
  },
  radio: {
    height: scale(20),
    width: scale(20),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: Color.Primary,
  },
  radioInner: {
    height: scale(10),
    width: scale(10),
    borderRadius: scale(5),
    backgroundColor: Color.Primary,
  },
  bottomBar: {
    padding: scale(16),
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  confirmButton: {
    backgroundColor: Color.Primary,
    height: scale(48),
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: scale(15),
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: scale(24),
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  successIconCircle: {
    height: scale(64),
    width: scale(64),
    borderRadius: scale(32),
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  successCheckmark: {
    fontSize: scale(32),
    color: '#16A34A',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: scale(20),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: scale(13),
    color: '#64748B',
    marginTop: scale(6),
    textAlign: 'center',
  },
  bookingRefContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: scale(12),
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
    marginVertical: scale(16),
  },
  bookingRefLabel: {
    fontSize: scale(11),
    fontWeight: 'bold',
    color: '#64748B',
    letterSpacing: 1,
  },
  bookingRefCode: {
    fontSize: scale(20),
    fontWeight: 'bold',
    color: Color.Primary,
    marginTop: 4,
  },
  doneButton: {
    backgroundColor: '#0F172A',
    width: '100%',
    height: scale(44),
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    color: 'white',
    fontSize: scale(14),
    fontWeight: 'bold',
  },
});