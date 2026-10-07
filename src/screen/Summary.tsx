import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useBooking } from '../context/BookingContext';
import { useToast } from '../components/ToastContext';
import { apiClient } from '../api';

const Summary = ({ navigation }: any) => {
  const {
    services,
    staff,
    date,
    slot,
    pricing,
    notes,
    setNotes,
    applyCoupon,
    coupon,
    loyaltyPointsToRedeem,
    setLoyaltyPoints,
  } = useBooking();
  const { showToast } = useToast();

  const [couponCodeInput, setCouponCodeInput] = useState<string>('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState<boolean>(false);

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) {
      showToast('Please enter a promo code', { type: 'warning' });
      return;
    }

    setIsValidatingCoupon(true);
    try {
      const result = await apiClient.promotions.validateCoupon({
        code: couponCodeInput.trim().toUpperCase(),
        orderAmountCents: pricing.subtotalCents,
        serviceIds: services.map((s) => s.id),
      });

      if (result.valid && result.coupon) {
        applyCoupon(result.coupon);
        showToast(`Promo ${result.coupon.code} applied! Saved $${(result.coupon.discountCents / 100).toFixed(2)}`, {
          type: 'success',
        });
      } else {
        showToast(result.reason || 'Invalid or expired coupon', { type: 'error' });
      }
    } catch {
      // Fallback mock validation for offline demos
      if (couponCodeInput.trim().toUpperCase() === 'WELCOME10') {
        const discount = Math.round(pricing.subtotalCents * 0.1);
        applyCoupon({
          id: 'cpn-welcome',
          code: 'WELCOME10',
          type: 'percentage',
          value: 10,
          discountCents: discount,
        });
        showToast('WELCOME10 applied (10% off)!', { type: 'success' });
      } else {
        showToast('Coupon code not recognized', { type: 'error' });
      }
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleToggleLoyalty = () => {
    if (loyaltyPointsToRedeem > 0) {
      setLoyaltyPoints(0);
      showToast('Loyalty points removed', { type: 'info' });
    } else {
      setLoyaltyPoints(500); // 500 points = $5.00 discount
      showToast('Redeemed 500 points ($5.00 off)', { type: 'success' });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Summary</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Appointment Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Appointment Details</Text>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Barber</Text>
            <Text style={styles.detailValue}>
              {staff ? `${staff.firstName} ${staff.lastName}` : 'Marcus Vance'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{date || 'Today'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>
              {slot?.startTime ? slot.startTime.split('T')[1]?.replace(':00.000Z', '') : '10:00 AM'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{pricing.durationMinutes || 45} mins</Text>
          </View>
        </View>

        {/* Selected Services */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Services ({services.length})</Text>
          <View style={styles.divider} />
          {services.map((svc) => (
            <View key={svc.id} style={styles.serviceRow}>
              <View>
                <Text style={styles.serviceName}>{svc.name}</Text>
                <Text style={styles.serviceDuration}>{svc.durationMinutes} mins</Text>
              </View>
              <Text style={styles.servicePrice}>${(svc.priceCents / 100).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Promo Code & Loyalty */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Promotions & Rewards</Text>
          <View style={styles.divider} />

          <View style={styles.promoInputRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="Promo code (e.g. WELCOME10)"
              placeholderTextColor="#94A3B8"
              value={couponCodeInput}
              onChangeText={setCouponCodeInput}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.promoButton}
              onPress={handleApplyCoupon}
              disabled={isValidatingCoupon}>
              {isValidatingCoupon ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.promoButtonText}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>

          {coupon ? (
            <View style={styles.appliedCouponBanner}>
              <Text style={styles.appliedCouponText}>
                ✓ Applied {coupon.code}: -${(coupon.discountCents / 100).toFixed(2)}
              </Text>
              <TouchableOpacity onPress={() => applyCoupon(null)}>
                <Text style={styles.removeCouponText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Loyalty Points Redemption */}
          <TouchableOpacity style={styles.loyaltyRow} onPress={handleToggleLoyalty}>
            <View>
              <Text style={styles.loyaltyTitle}>Redeem Loyalty Points</Text>
              <Text style={styles.loyaltySubtitle}>Use 500 points for $5.00 off</Text>
            </View>
            <View style={[styles.loyaltySwitch, loyaltyPointsToRedeem > 0 && styles.loyaltySwitchActive]}>
              <Text style={[styles.loyaltySwitchText, loyaltyPointsToRedeem > 0 && styles.loyaltySwitchTextActive]}>
                {loyaltyPointsToRedeem > 0 ? 'Applied' : 'Redeem'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Special Requests & Notes</Text>
          <View style={styles.divider} />
          <TextInput
            style={styles.notesInput}
            placeholder="Add notes for your barber (e.g., skin sensitive, prefer scissor cut)..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Cost Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Cost Breakdown</Text>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Subtotal</Text>
            <Text style={styles.detailValue}>${(pricing.subtotalCents / 100).toFixed(2)}</Text>
          </View>

          {pricing.discountCents > 0 && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: '#16A34A' }]}>Coupon Discount</Text>
              <Text style={[styles.detailValue, { color: '#16A34A' }]}>
                -${(pricing.discountCents / 100).toFixed(2)}
              </Text>
            </View>
          )}

          {pricing.loyaltyDiscountCents > 0 && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: '#16A34A' }]}>Loyalty Points</Text>
              <Text style={[styles.detailValue, { color: '#16A34A' }]}>
                -${(pricing.loyaltyDiscountCents / 100).toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estimated Tax</Text>
            <Text style={styles.detailValue}>${(pricing.taxCents / 100).toFixed(2)}</Text>
          </View>

          <View style={[styles.divider, { marginVertical: scale(8) }]} />

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { fontWeight: 'bold', fontSize: 16 }]}>Total</Text>
            <Text style={[styles.detailValue, { fontWeight: 'bold', fontSize: 18, color: Color.Primary }]}>
              ${(pricing.totalCents / 100).toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.totalLabel}>Total to Pay</Text>
          <Text style={styles.totalValue}>${(pricing.totalCents / 100).toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={() => navigation.navigate('Checkout')}>
          <Text style={styles.checkoutButtonText}>Proceed to Checkout →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Summary;

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
  scrollContent: {
    padding: scale(16),
    paddingBottom: scale(100),
    gap: scale(12),
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: scale(16),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    fontSize: scale(15),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: scale(10),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: scale(4),
  },
  detailLabel: {
    fontSize: scale(14),
    color: '#64748B',
  },
  detailValue: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#1E293B',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: scale(6),
  },
  serviceName: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#1E293B',
  },
  serviceDuration: {
    fontSize: scale(12),
    color: '#64748B',
    marginTop: 2,
  },
  servicePrice: {
    fontSize: scale(14),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  promoInputRow: {
    flexDirection: 'row',
    gap: scale(8),
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    fontSize: scale(14),
    color: '#0F172A',
  },
  promoButton: {
    backgroundColor: '#0F172A',
    paddingHorizontal: scale(16),
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: scale(13),
  },
  appliedCouponBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: scale(10),
    borderRadius: 8,
    marginTop: scale(10),
  },
  appliedCouponText: {
    color: '#16A34A',
    fontWeight: '600',
    fontSize: scale(13),
  },
  removeCouponText: {
    color: '#DC2626',
    fontSize: scale(12),
    fontWeight: '600',
  },
  loyaltyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(14),
    paddingTop: scale(10),
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  loyaltyTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#1E293B',
  },
  loyaltySubtitle: {
    fontSize: scale(12),
    color: '#64748B',
    marginTop: 2,
  },
  loyaltySwitch: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  loyaltySwitchActive: {
    backgroundColor: '#16A34A',
  },
  loyaltySwitchText: {
    fontSize: scale(12),
    fontWeight: '600',
    color: '#475569',
  },
  loyaltySwitchTextActive: {
    color: 'white',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: scale(10),
    fontSize: scale(13),
    color: '#0F172A',
    textAlignVertical: 'top',
    minHeight: scale(60),
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingVertical: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  totalLabel: {
    fontSize: scale(12),
    color: '#64748B',
  },
  totalValue: {
    fontSize: scale(18),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  checkoutButton: {
    backgroundColor: Color.Primary,
    paddingHorizontal: scale(20),
    paddingVertical: scale(12),
    borderRadius: 24,
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: scale(14),
    fontWeight: 'bold',
  },
});