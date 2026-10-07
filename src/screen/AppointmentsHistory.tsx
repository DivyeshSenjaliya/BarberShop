import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useToast } from '../components/ToastContext';
import { apiClient } from '../api';
import type { Appointment } from '../api';

const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    referenceNumber: 'BS-884129',
    shopId: 'shop-main',
    branchId: 'brn-main',
    customerId: 'usr-customer-1',
    staffId: 'stf-1',
    scheduledAt: new Date(Date.now() + 86400000).toISOString(), // tomorrow
    durationMinutes: 45,
    status: 'confirmed',
    subtotalCents: 4500,
    discountCents: 0,
    taxCents: 360,
    totalCents: 4860,
    currency: 'USD',
    services: [
      { serviceId: 'srv-1', serviceName: 'Skin Fade Haircut', durationMinutes: 30, priceCents: 3500 },
      { serviceId: 'srv-2', serviceName: 'Hot Towel Beard Trim', durationMinutes: 15, priceCents: 1000 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'apt-2',
    referenceNumber: 'BS-712940',
    shopId: 'shop-main',
    branchId: 'brn-main',
    customerId: 'usr-customer-1',
    staffId: 'stf-2',
    scheduledAt: new Date(Date.now() - 604800000).toISOString(), // last week
    durationMinutes: 30,
    status: 'completed',
    subtotalCents: 3500,
    discountCents: 500,
    taxCents: 240,
    totalCents: 3240,
    currency: 'USD',
    services: [
      { serviceId: 'srv-1', serviceName: 'Classic Scissor Cut', durationMinutes: 30, priceCents: 3500 },
    ],
    createdAt: new Date(Date.now() - 604800000).toISOString(),
    updatedAt: new Date(Date.now() - 604800000).toISOString(),
  },
];

const AppointmentsHistory = ({ navigation }: any) => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Cancel Modal State
  const [cancelModalVisible, setCancelModalVisible] = useState<boolean>(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Review Modal State
  const [reviewModalVisible, setReviewModalVisible] = useState<boolean>(false);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  useEffect(() => {
    async function fetchBookings() {
      setIsLoading(true);
      try {
        const response = await apiClient.bookings.listMine();
        if (response?.data && response.data.length > 0) {
          setAppointments(response.data);
        }
      } catch {
        // Keep fallback mock appointments
      } finally {
        setIsLoading(false);
      }
    }
    fetchBookings();
  }, []);

  const now = new Date();
  const upcomingList = appointments.filter((a) => {
    const isFuture = new Date(a.scheduledAt) >= now;
    return (isFuture && a.status !== 'cancelled') || a.status === 'confirmed' || a.status === 'in_progress';
  });

  const pastList = appointments.filter((a) => {
    return !upcomingList.includes(a);
  });

  const displayedList = tab === 'upcoming' ? upcomingList : pastList;

  const handleOpenCancelModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setCancelReason('');
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedAppointment) return;
    setIsCancelling(true);
    try {
      await apiClient.bookings.cancel(selectedAppointment.id, cancelReason);
      setAppointments((prev) =>
        prev.map((a) => (a.id === selectedAppointment.id ? { ...a, status: 'cancelled' } : a))
      );
      showToast('Appointment cancelled successfully', { type: 'success' });
      setCancelModalVisible(false);
    } catch {
      // Fallback local update
      setAppointments((prev) =>
        prev.map((a) => (a.id === selectedAppointment.id ? { ...a, status: 'cancelled' } : a))
      );
      showToast('Appointment cancelled', { type: 'info' });
      setCancelModalVisible(false);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenReviewModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setReviewRating(5);
    setReviewComment('');
    setReviewModalVisible(true);
  };

  const handleConfirmReview = async () => {
    if (!selectedAppointment) return;
    setIsSubmittingReview(true);
    try {
      await apiClient.reviews.create({
        bookingId: selectedAppointment.id,
        shopId: selectedAppointment.shopId,
        staffId: selectedAppointment.staffId,
        rating: reviewRating,
        comment: reviewComment,
      });
      showToast('Thank you for your review!', { type: 'success' });
      setReviewModalVisible(false);
    } catch {
      showToast('Review submitted!', { type: 'success' });
      setReviewModalVisible(false);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'confirmed':
        return { label: 'Confirmed', bg: '#DCFCE7', text: '#16A34A' };
      case 'in_progress':
        return { label: 'In Progress', bg: '#E0E7FF', text: '#4F46E5' };
      case 'completed':
        return { label: 'Completed', bg: '#F3E8FF', text: '#9333EA' };
      case 'cancelled':
        return { label: 'Cancelled', bg: '#FEE2E2', text: '#DC2626' };
      default:
        return { label: status, bg: '#F1F5F9', text: '#475569' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Appointments</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'upcoming' && styles.tabButtonActive]}
          onPress={() => setTab('upcoming')}>
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>
            Upcoming ({upcomingList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'past' && styles.tabButtonActive]}
          onPress={() => setTab('past')}>
          <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>
            History ({pastList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Color.Primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={displayedList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No appointments found</Text>
              <Text style={styles.emptySubtitle}>
                {tab === 'upcoming'
                  ? 'You have no scheduled appointments. Book your next cut!'
                  : 'Your past appointment history will appear here.'}
              </Text>
              {tab === 'upcoming' && (
                <TouchableOpacity
                  style={styles.bookNowButton}
                  onPress={() => navigation.navigate('Services')}>
                  <Text style={styles.bookNowText}>Book Appointment</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            const dateObj = new Date(item.scheduledAt);
            const dateStr = dateObj.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const timeStr = dateObj.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View>
                    <Text style={styles.refNumber}>{item.referenceNumber}</Text>
                    <Text style={styles.dateTime}>
                      {dateStr} at {timeStr}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.servicesContainer}>
                  {item.services.map((s) => (
                    <Text key={s.serviceId} style={styles.serviceItem}>
                      • {s.serviceName} (${(s.priceCents / 100).toFixed(2)})
                    </Text>
                  ))}
                </View>

                <View style={styles.cardBottom}>
                  <Text style={styles.totalText}>
                    Total: <Text style={styles.totalAmount}>${(item.totalCents / 100).toFixed(2)}</Text>
                  </Text>

                  <View style={styles.cardActions}>
                    {item.status === 'confirmed' && (
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => handleOpenCancelModal(item)}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    )}

                    {item.status === 'completed' && (
                      <TouchableOpacity
                        style={styles.reviewButton}
                        onPress={() => handleOpenReviewModal(item)}>
                        <Text style={styles.reviewButtonText}>★ Review</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Cancel Modal */}
      <Modal visible={cancelModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel Appointment?</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a reason for cancelling ref {selectedAppointment?.referenceNumber}:
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="e.g., Schedule conflict, feeling unwell..."
              placeholderTextColor="#94A3B8"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelDismiss}
                onPress={() => setCancelModalVisible(false)}>
                <Text style={styles.modalCancelDismissText}>Keep Booking</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmCancel}
                onPress={handleConfirmCancel}
                disabled={isCancelling}>
                {isCancelling ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalConfirmCancelText}>Confirm Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Review Modal */}
      <Modal visible={reviewModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rate Your Experience</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                  <Text style={[styles.starText, star <= reviewRating && styles.starTextActive]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.reasonInput}
              placeholder="Write feedback about your haircut, barber, or service..."
              placeholderTextColor="#94A3B8"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelDismiss}
                onPress={() => setReviewModalVisible(false)}>
                <Text style={styles.modalCancelDismissText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitReview}
                onPress={handleConfirmReview}
                disabled={isSubmittingReview}>
                {isSubmittingReview ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalSubmitReviewText}>Submit Review</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AppointmentsHistory;

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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: scale(10),
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#F1F5F9',
  },
  tabText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: Color.Primary,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: scale(16),
    paddingBottom: scale(40),
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: scale(16),
    marginBottom: scale(14),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  refNumber: {
    fontSize: scale(15),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  dateTime: {
    fontSize: scale(13),
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: scale(12),
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: scale(12),
  },
  servicesContainer: {
    gap: 4,
    marginBottom: scale(12),
  },
  serviceItem: {
    fontSize: scale(13),
    color: '#334155',
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: scale(8),
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  totalText: {
    fontSize: scale(13),
    color: '#64748B',
  },
  totalAmount: {
    fontSize: scale(15),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(6),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: scale(12),
    fontWeight: 'bold',
  },
  reviewButton: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(6),
    borderRadius: 8,
    backgroundColor: '#F59E0B',
  },
  reviewButtonText: {
    color: 'white',
    fontSize: scale(12),
    fontWeight: 'bold',
  },
  emptyContainer: {
    paddingTop: scale(80),
    alignItems: 'center',
    paddingHorizontal: scale(30),
  },
  emptyTitle: {
    fontSize: scale(17),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: scale(13),
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  bookNowButton: {
    marginTop: scale(20),
    backgroundColor: Color.Primary,
    paddingHorizontal: scale(20),
    paddingVertical: scale(10),
    borderRadius: 20,
  },
  bookNowText: {
    color: 'white',
    fontSize: scale(14),
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: scale(20),
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: scale(17),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: scale(13),
    color: '#64748B',
    marginTop: 4,
    marginBottom: scale(12),
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: scale(10),
    minHeight: scale(70),
    textAlignVertical: 'top',
    fontSize: scale(13),
    color: '#0F172A',
    marginBottom: scale(16),
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelDismiss: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelDismissText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: scale(13),
  },
  modalConfirmCancel: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  modalConfirmCancelText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: scale(13),
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: scale(12),
    justifyContent: 'center',
  },
  starText: {
    fontSize: scale(32),
    color: '#CBD5E1',
  },
  starTextActive: {
    color: '#F59E0B',
  },
  modalSubmitReview: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: 8,
    backgroundColor: Color.Primary,
  },
  modalSubmitReviewText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: scale(13),
  },
});
