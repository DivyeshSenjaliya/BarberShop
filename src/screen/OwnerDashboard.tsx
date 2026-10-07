import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  FlatList,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useToast } from '../components/ToastContext';

interface BarberPerformance {
  id: string;
  name: string;
  role: string;
  rating: number;
  completedBookings: number;
  revenueCents: number;
}

interface PopularService {
  id: string;
  name: string;
  bookingsCount: number;
  revenueCents: number;
}

const MOCK_BARBERS: BarberPerformance[] = [
  {
    id: 'stf-1',
    name: 'Marcus Vance',
    role: 'Master Barber',
    rating: 4.9,
    completedBookings: 84,
    revenueCents: 378000, // $3,780.00
  },
  {
    id: 'stf-2',
    name: 'Derrick Hayes',
    role: 'Senior Stylist',
    rating: 4.8,
    completedBookings: 62,
    revenueCents: 248000, // $2,480.00
  },
  {
    id: 'stf-3',
    name: 'Leo Romero',
    role: 'Barber',
    rating: 4.7,
    completedBookings: 46,
    revenueCents: 161000, // $1,610.00
  },
];

const MOCK_SERVICES: PopularService[] = [
  { id: 'svc-1', name: 'Signature Skin Fade', bookingsCount: 112, revenueCents: 392000 },
  { id: 'svc-2', name: 'Hot Towel Razor Shave', bookingsCount: 58, revenueCents: 174000 },
  { id: 'svc-3', name: 'Beard Sculpting & Lineup', bookingsCount: 44, revenueCents: 110000 },
  { id: 'svc-4', name: 'Executive Grooming Package', bookingsCount: 26, revenueCents: 195000 },
];

const DAILY_REVENUE = [
  { day: 'Mon', amount: 920, heightPercent: 45 },
  { day: 'Tue', amount: 1140, heightPercent: 55 },
  { day: 'Wed', amount: 1380, heightPercent: 68 },
  { day: 'Thu', amount: 1620, heightPercent: 80 },
  { day: 'Fri', amount: 2050, heightPercent: 100 },
  { day: 'Sat', amount: 1980, heightPercent: 96 },
  { day: 'Sun', amount: 840, heightPercent: 40 },
];

const OwnerDashboard = ({ navigation }: any) => {
  const { showToast } = useToast();
  const [range, setRange] = useState<'7d' | '30d' | 'month'>('7d');

  const totalGrossCents = 993000; // $9,930.00
  const netIncomeCents = 397200; // $3,972.00 (after 60% staff commission)
  const totalBookings = 192;
  const cancellationRate = '2.6%';

  const handleExportPdf = () => {
    showToast('Executive PDF report downloaded to device', { type: 'success' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shop Owner Analytics</Text>
        <TouchableOpacity onPress={handleExportPdf} style={styles.pdfButton}>
          <Text style={styles.pdfButtonText}>PDF</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Date Filter Pills */}
        <View style={styles.dateFilterRow}>
          <TouchableOpacity
            style={[styles.filterPill, range === '7d' && styles.filterPillActive]}
            onPress={() => setRange('7d')}>
            <Text style={[styles.filterText, range === '7d' && styles.filterTextActive]}>
              Last 7 Days
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, range === '30d' && styles.filterPillActive]}
            onPress={() => setRange('30d')}>
            <Text style={[styles.filterText, range === '30d' && styles.filterTextActive]}>
              Last 30 Days
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, range === 'month' && styles.filterPillActive]}
            onPress={() => setRange('month')}>
            <Text style={[styles.filterText, range === 'month' && styles.filterTextActive]}>
              This Month
            </Text>
          </TouchableOpacity>
        </View>

        {/* Primary KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Gross Sales</Text>
            <Text style={styles.kpiValue}>${(totalGrossCents / 100).toFixed(2)}</Text>
            <Text style={styles.kpiTrend}>▲ +14% vs prev week</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Net Shop Income</Text>
            <Text style={[styles.kpiValue, { color: '#16A34A' }]}>
              ${(netIncomeCents / 100).toFixed(2)}
            </Text>
            <Text style={styles.kpiTrend}>40% shop margin</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Bookings</Text>
            <Text style={styles.kpiValue}>{totalBookings}</Text>
            <Text style={styles.kpiTrend}>186 completed</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Cancellation Rate</Text>
            <Text style={[styles.kpiValue, { color: '#D97706' }]}>{cancellationRate}</Text>
            <Text style={styles.kpiTrend}>5 cancellations</Text>
          </View>
        </View>

        {/* Daily Revenue Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.cardHeading}>Weekly Revenue Volume</Text>
          <View style={styles.barsContainer}>
            {DAILY_REVENUE.map((bar) => (
              <View key={bar.day} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${bar.heightPercent}%`,
                        backgroundColor: bar.heightPercent === 100 ? Color.Primary : '#CBD5E1',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barDayText}>{bar.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Top Performing Staff Leaderboard */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeading}>Staff Leaderboard</Text>
          <View style={styles.staffLeaderboard}>
            {MOCK_BARBERS.map((barber, index) => (
              <View key={barber.id} style={styles.staffRankRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankNumber}>#{index + 1}</Text>
                </View>
                <View style={styles.staffInfo}>
                  <Text style={styles.staffName}>{barber.name}</Text>
                  <Text style={styles.staffStats}>
                    {barber.completedBookings} cuts • ★ {barber.rating.toFixed(1)}
                  </Text>
                </View>
                <Text style={styles.staffRevenue}>
                  ${(barber.revenueCents / 100).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Popular Services */}
        <View style={styles.sectionCard}>
          <Text style={styles.cardHeading}>Top Requested Services</Text>
          <View style={styles.servicesLeaderboard}>
            {MOCK_SERVICES.map((svc) => (
              <View key={svc.id} style={styles.serviceItemRow}>
                <View style={styles.serviceDetails}>
                  <Text style={styles.serviceName}>{svc.name}</Text>
                  <Text style={styles.serviceCount}>{svc.bookingsCount} appointments</Text>
                </View>
                <Text style={styles.serviceRevenue}>
                  ${(svc.revenueCents / 100).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default OwnerDashboard;

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
  pdfButton: {
    backgroundColor: '#0F172A',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: 8,
  },
  pdfButtonText: {
    color: 'white',
    fontSize: scale(12),
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: scale(16),
    paddingBottom: scale(40),
    gap: scale(14),
  },
  dateFilterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(6),
    borderRadius: 14,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterText: {
    fontSize: scale(12),
    fontWeight: '600',
    color: '#64748B',
  },
  filterTextActive: {
    color: 'white',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: scale(14),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiLabel: {
    fontSize: scale(12),
    color: '#64748B',
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: scale(20),
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 4,
  },
  kpiTrend: {
    fontSize: scale(11),
    color: '#16A34A',
    marginTop: 4,
    fontWeight: '500',
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: scale(18),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeading: {
    fontSize: scale(15),
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: scale(14),
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: scale(120),
    paddingTop: scale(10),
  },
  barCol: {
    alignItems: 'center',
    width: '12%',
  },
  barTrack: {
    width: '100%',
    height: scale(90),
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: scale(14),
    borderRadius: 4,
  },
  barDayText: {
    fontSize: scale(11),
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: scale(18),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  staffLeaderboard: {
    gap: scale(12),
  },
  staffRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: scale(12),
    fontWeight: 'bold',
    color: '#475569',
  },
  staffInfo: {
    flex: 1,
    marginLeft: scale(12),
  },
  staffName: {
    fontSize: scale(14),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  staffStats: {
    fontSize: scale(12),
    color: '#64748B',
    marginTop: 2,
  },
  staffRevenue: {
    fontSize: scale(14),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  servicesLeaderboard: {
    gap: scale(12),
  },
  serviceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: scale(8),
  },
  serviceDetails: {
    flex: 1,
  },
  serviceName: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#1E293B',
  },
  serviceCount: {
    fontSize: scale(11),
    color: '#64748B',
    marginTop: 2,
  },
  serviceRevenue: {
    fontSize: scale(13),
    fontWeight: 'bold',
    color: '#0F172A',
  },
});
