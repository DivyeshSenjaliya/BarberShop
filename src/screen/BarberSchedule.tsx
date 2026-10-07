import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useToast } from '../components/ToastContext';

export interface BarberAppointment {
  id: string;
  referenceNumber: string;
  customerName: string;
  customerPhone: string;
  timeSlot: string;
  durationMinutes: number;
  services: string[];
  totalCents: number;
  status: 'confirmed' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';
  notes?: string;
}

const INITIAL_SCHEDULE: BarberAppointment[] = [
  {
    id: 'apt-101',
    referenceNumber: 'BS-90214',
    customerName: 'Marcus Aurelius',
    customerPhone: '+1 (555) 234-5678',
    timeSlot: '09:00 AM - 09:45 AM',
    durationMinutes: 45,
    services: ['Signature Skin Fade', 'Beard Sculpting'],
    totalCents: 5500,
    status: 'in_progress',
    notes: 'Low taper fade, keep natural beard line',
  },
  {
    id: 'apt-102',
    referenceNumber: 'BS-90215',
    customerName: 'Tyler Brooks',
    customerPhone: '+1 (555) 876-5432',
    timeSlot: '10:00 AM - 10:30 AM',
    durationMinutes: 30,
    services: ['Classic Crew Cut'],
    totalCents: 3500,
    status: 'confirmed',
  },
  {
    id: 'apt-103',
    referenceNumber: 'BS-90216',
    customerName: 'Daniel Vance',
    customerPhone: '+1 (555) 345-6789',
    timeSlot: '11:00 AM - 11:45 AM',
    durationMinutes: 45,
    services: ['Hot Towel Razor Shave', 'Facial Mask'],
    totalCents: 4500,
    status: 'confirmed',
  },
  {
    id: 'apt-104',
    referenceNumber: 'BS-90210',
    customerName: 'Ethan Cole',
    customerPhone: '+1 (555) 456-7890',
    timeSlot: '08:00 AM - 08:30 AM',
    durationMinutes: 30,
    services: ['Beard Lineup'],
    totalCents: 2500,
    status: 'completed',
  },
];

const BarberSchedule = ({ navigation }: any) => {
  const { showToast } = useToast();
  const [status, setStatus] = useState<'available' | 'on_break' | 'offline'>('available');
  const [appointments, setAppointments] = useState<BarberAppointment[]>(INITIAL_SCHEDULE);
  const [activeDateIndex, setActiveDateIndex] = useState<number>(0);

  const dates = ['Today', 'Tomorrow', 'Thu, Oct 9', 'Fri, Oct 10', 'Sat, Oct 11'];

  const handleUpdateStatus = (id: string, newStatus: BarberAppointment['status']) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    );

    const message =
      newStatus === 'in_progress'
        ? 'Service started!'
        : newStatus === 'completed'
        ? 'Service completed! Earnings credited.'
        : 'Appointment marked as no-show.';
    showToast(message, { type: 'success' });
  };

  const completedCount = appointments.filter((a) => a.status === 'completed').length;
  const inProgressCount = appointments.filter((a) => a.status === 'in_progress').length;
  const estimatedEarnings = appointments
    .filter((a) => a.status === 'completed' || a.status === 'in_progress' || a.status === 'confirmed')
    .reduce((acc, a) => acc + Math.round((a.totalCents * 0.6) / 100), 0); // 60% commission

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Schedule</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Staff Status Selector */}
      <View style={styles.statusRow}>
        <Text style={styles.staffStatusLabel}>Staff Status:</Text>
        <View style={styles.statusButtons}>
          <TouchableOpacity
            style={[styles.statusBtn, status === 'available' && styles.statusBtnAvailable]}
            onPress={() => {
              setStatus('available');
              showToast('You are now available for bookings', { type: 'success' });
            }}>
            <Text style={[styles.statusBtnText, status === 'available' && styles.statusBtnTextActive]}>
              Available
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusBtn, status === 'on_break' && styles.statusBtnBreak]}
            onPress={() => {
              setStatus('on_break');
              showToast('Status set to On Break', { type: 'info' });
            }}>
            <Text style={[styles.statusBtnText, status === 'on_break' && styles.statusBtnTextActive]}>
              On Break
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusBtn, status === 'offline' && styles.statusBtnOffline]}
            onPress={() => {
              setStatus('offline');
              showToast('Status set to Offline', { type: 'warning' });
            }}>
            <Text style={[styles.statusBtnText, status === 'offline' && styles.statusBtnTextActive]}>
              Offline
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Daily Metrics Card */}
      <View style={styles.metricsCard}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{appointments.length}</Text>
          <Text style={styles.metricLabel}>Total Booked</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{completedCount}</Text>
          <Text style={styles.metricLabel}>Completed</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: '#16A34A' }]}>${estimatedEarnings}</Text>
          <Text style={styles.metricLabel}>Est. Commission</Text>
        </View>
      </View>

      {/* Date Filter Tabs */}
      <View style={styles.dateRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={dates}
          keyExtractor={(d) => d}
          renderItem={({ item, index }) => {
            const isSelected = activeDateIndex === index;
            return (
              <TouchableOpacity
                style={[styles.dateTab, isSelected && styles.dateTabActive]}
                onPress={() => setActiveDateIndex(index)}>
                <Text style={[styles.dateTabText, isSelected && styles.dateTabTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Appointments Timeline */}
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.customerName}>{item.customerName}</Text>
                  <Text style={styles.timeSlot}>{item.timeSlot}</Text>
                  <Text style={styles.phoneText}>📞 {item.customerPhone}</Text>
                </View>
                <View style={[styles.badge, styles[`badge_${item.status}`]]}>
                  <Text style={[styles.badgeText, styles[`badgeText_${item.status}`]]}>
                    {item.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.servicesBox}>
                <Text style={styles.servicesLabel}>Requested Services:</Text>
                <Text style={styles.servicesList}>{item.services.join(' • ')}</Text>
              </View>

              {item.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Customer Note:</Text>
                  <Text style={styles.notesText}>{item.notes}</Text>
                </View>
              ) : null}

              {/* Actions depending on state */}
              <View style={styles.actionRow}>
                {item.status === 'confirmed' && (
                  <>
                    <TouchableOpacity
                      style={styles.startBtn}
                      onPress={() => handleUpdateStatus(item.id, 'in_progress')}>
                      <Text style={styles.startBtnText}>▶ Start Service</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.noShowBtn}
                      onPress={() => handleUpdateStatus(item.id, 'no_show')}>
                      <Text style={styles.noShowBtnText}>No-Show</Text>
                    </TouchableOpacity>
                  </>
                )}

                {item.status === 'in_progress' && (
                  <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={() => handleUpdateStatus(item.id, 'completed')}>
                    <Text style={styles.completeBtnText}>✓ Complete Service</Text>
                  </TouchableOpacity>
                )}

                {item.status === 'completed' && (
                  <Text style={styles.completedText}>✓ Service Finished & Logged</Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

export default BarberSchedule;

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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  staffStatusLabel: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#475569',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBtn: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  statusBtnAvailable: {
    backgroundColor: '#16A34A',
  },
  statusBtnBreak: {
    backgroundColor: '#D97706',
  },
  statusBtnOffline: {
    backgroundColor: '#64748B',
  },
  statusBtnText: {
    fontSize: scale(12),
    color: '#475569',
    fontWeight: '600',
  },
  statusBtnTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  metricsCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    margin: scale(16),
    marginBottom: scale(8),
    borderRadius: 14,
    padding: scale(14),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: scale(18),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  metricLabel: {
    fontSize: scale(11),
    color: '#64748B',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  dateRow: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
  },
  dateTab: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(6),
    borderRadius: 14,
    backgroundColor: 'white',
    marginRight: scale(8),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateTabActive: {
    backgroundColor: Color.Primary,
    borderColor: Color.Primary,
  },
  dateTabText: {
    fontSize: scale(12),
    color: '#475569',
    fontWeight: '600',
  },
  dateTabTextActive: {
    color: 'white',
  },
  listContent: {
    padding: scale(16),
    paddingBottom: scale(40),
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: scale(16),
    marginBottom: scale(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerName: {
    fontSize: scale(16),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  timeSlot: {
    fontSize: scale(13),
    color: '#64748B',
    marginTop: 2,
  },
  phoneText: {
    fontSize: scale(12),
    color: '#475569',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: 6,
  },
  badge_confirmed: { backgroundColor: '#DCFCE7' },
  badge_in_progress: { backgroundColor: '#E0E7FF' },
  badge_completed: { backgroundColor: '#F3E8FF' },
  badge_no_show: { backgroundColor: '#FEE2E2' },
  badge_cancelled: { backgroundColor: '#F1F5F9' },
  badgeText: { fontSize: scale(10), fontWeight: 'bold' },
  badgeText_confirmed: { color: '#16A34A' },
  badgeText_in_progress: { color: '#4F46E5' },
  badgeText_completed: { color: '#9333EA' },
  badgeText_no_show: { color: '#DC2626' },
  badgeText_cancelled: { color: '#64748B' },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: scale(10),
  },
  servicesBox: {
    marginBottom: scale(8),
  },
  servicesLabel: {
    fontSize: scale(11),
    fontWeight: 'bold',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  servicesList: {
    fontSize: scale(13),
    color: '#1E293B',
    marginTop: 2,
  },
  notesBox: {
    backgroundColor: '#FFFBEB',
    padding: scale(8),
    borderRadius: 6,
    marginBottom: scale(10),
  },
  notesLabel: {
    fontSize: scale(11),
    fontWeight: 'bold',
    color: '#D97706',
  },
  notesText: {
    fontSize: scale(12),
    color: '#78350F',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: scale(6),
  },
  startBtn: {
    flex: 1,
    backgroundColor: Color.Primary,
    paddingVertical: scale(10),
    borderRadius: 8,
    alignItems: 'center',
  },
  startBtnText: {
    color: 'white',
    fontSize: scale(13),
    fontWeight: 'bold',
  },
  noShowBtn: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  noShowBtnText: {
    color: '#EF4444',
    fontSize: scale(13),
    fontWeight: '600',
  },
  completeBtn: {
    flex: 1,
    backgroundColor: '#16A34A',
    paddingVertical: scale(10),
    borderRadius: 8,
    alignItems: 'center',
  },
  completeBtnText: {
    color: 'white',
    fontSize: scale(13),
    fontWeight: 'bold',
  },
  completedText: {
    color: '#9333EA',
    fontSize: scale(13),
    fontWeight: 'bold',
  },
});
