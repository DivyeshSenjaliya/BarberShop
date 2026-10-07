import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  FlatList,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useToast } from '../components/ToastContext';

interface EarningRecord {
  id: string;
  referenceNumber: string;
  serviceName: string;
  grossCents: number;
  commissionCents: number;
  tipCents: number;
  netCents: number;
  date: string;
}

const MOCK_EARNINGS: EarningRecord[] = [
  {
    id: 'ern-1',
    referenceNumber: 'BS-90214',
    serviceName: 'Signature Skin Fade + Beard',
    grossCents: 5500,
    commissionCents: 3300, // 60% of $55
    tipCents: 1000, // $10 tip
    netCents: 4300, // $43.00
    date: 'Today, 09:45 AM',
  },
  {
    id: 'ern-2',
    referenceNumber: 'BS-90210',
    serviceName: 'Beard Lineup & Hot Towel',
    grossCents: 2500,
    commissionCents: 1500,
    tipCents: 500,
    netCents: 2000,
    date: 'Today, 08:30 AM',
  },
  {
    id: 'ern-3',
    referenceNumber: 'BS-89102',
    serviceName: 'Full Grooming Executive',
    grossCents: 7500,
    commissionCents: 4500,
    tipCents: 1500,
    netCents: 6000,
    date: 'Yesterday, 04:15 PM',
  },
  {
    id: 'ern-4',
    referenceNumber: 'BS-89055',
    serviceName: 'Classic Scissor Cut',
    grossCents: 3500,
    commissionCents: 2100,
    tipCents: 700,
    netCents: 2800,
    date: 'Oct 5, 02:00 PM',
  },
];

const BarberEarnings = ({ navigation }: any) => {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [records] = useState<EarningRecord[]>(MOCK_EARNINGS);

  const totalGrossCents = records.reduce((acc, r) => acc + r.grossCents, 0);
  const totalCommissionCents = records.reduce((acc, r) => acc + r.commissionCents, 0);
  const totalTipsCents = records.reduce((acc, r) => acc + r.tipCents, 0);
  const totalNetCents = records.reduce((acc, r) => acc + r.netCents, 0);

  const handleExportStatement = () => {
    showToast('Earnings statement sent to registered email', { type: 'success' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings & Commission</Text>
        <TouchableOpacity onPress={handleExportStatement} style={styles.exportBtn}>
          <Text style={styles.exportBtnText}>Export</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {/* Total Net Earnings Card */}
            <View style={styles.mainCard}>
              <View style={styles.cardTopRow}>
                <Text style={styles.mainLabel}>NET EARNINGS (THIS WEEK)</Text>
                <View style={styles.commissionBadge}>
                  <Text style={styles.commissionBadgeText}>60% Commission</Text>
                </View>
              </View>
              <Text style={styles.mainAmount}>${(totalNetCents / 100).toFixed(2)}</Text>
              <Text style={styles.payoutNotice}>Next direct deposit: Friday, Oct 10</Text>
            </View>

            {/* Financial Breakdown Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Service Commission</Text>
                <Text style={styles.statValue}>${(totalCommissionCents / 100).toFixed(2)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Tips Received</Text>
                <Text style={[styles.statValue, { color: '#16A34A' }]}>
                  +${(totalTipsCents / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Gross Sales</Text>
                <Text style={styles.statValue}>${(totalGrossCents / 100).toFixed(2)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Completed Cuts</Text>
                <Text style={styles.statValue}>{records.length}</Text>
              </View>
            </View>

            {/* Filter Period Tabs */}
            <View style={styles.periodRow}>
              <Text style={styles.sectionTitle}>Itemized Cuts</Text>
              <View style={styles.periodPills}>
                <TouchableOpacity
                  style={[styles.periodPill, period === 'week' && styles.periodPillActive]}
                  onPress={() => setPeriod('week')}>
                  <Text style={[styles.periodText, period === 'week' && styles.periodTextActive]}>
                    Week
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodPill, period === 'month' && styles.periodPillActive]}
                  onPress={() => setPeriod('month')}>
                  <Text style={[styles.periodText, period === 'month' && styles.periodTextActive]}>
                    Month
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodPill, period === 'quarter' && styles.periodPillActive]}
                  onPress={() => setPeriod('quarter')}>
                  <Text style={[styles.periodText, period === 'quarter' && styles.periodTextActive]}>
                    Quarter
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.recordCard}>
            <View style={styles.recordTop}>
              <View>
                <Text style={styles.serviceName}>{item.serviceName}</Text>
                <Text style={styles.recordMeta}>
                  {item.referenceNumber} • {item.date}
                </Text>
              </View>
              <Text style={styles.recordNet}>+${(item.netCents / 100).toFixed(2)}</Text>
            </View>

            <View style={styles.recordBreakdown}>
              <Text style={styles.breakdownItem}>
                Gross: ${(item.grossCents / 100).toFixed(2)}
              </Text>
              <Text style={styles.breakdownItem}>
                Commission: ${(item.commissionCents / 100).toFixed(2)}
              </Text>
              <Text style={[styles.breakdownItem, { color: '#16A34A', fontWeight: 'bold' }]}>
                Tip: +${(item.tipCents / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
};

export default BarberEarnings;

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
  exportBtn: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  exportBtnText: {
    fontSize: scale(12),
    fontWeight: 'bold',
    color: Color.Primary,
  },
  scrollContent: {
    padding: scale(16),
    paddingBottom: scale(40),
  },
  mainCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: scale(20),
    marginBottom: scale(14),
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainLabel: {
    fontSize: scale(11),
    fontWeight: 'bold',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  commissionBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: 6,
  },
  commissionBadgeText: {
    color: '#38BDF8',
    fontSize: scale(11),
    fontWeight: 'bold',
  },
  mainAmount: {
    fontSize: scale(32),
    fontWeight: 'bold',
    color: 'white',
    marginTop: 6,
  },
  payoutNotice: {
    fontSize: scale(12),
    color: '#94A3B8',
    marginTop: scale(10),
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: scale(20),
  },
  statBox: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: scale(14),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: scale(12),
    color: '#64748B',
    fontWeight: '500',
  },
  statValue: {
    fontSize: scale(17),
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 4,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  sectionTitle: {
    fontSize: scale(16),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  periodPills: {
    flexDirection: 'row',
    gap: 6,
  },
  periodPill: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(4),
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  periodPillActive: {
    backgroundColor: '#0F172A',
  },
  periodText: {
    fontSize: scale(12),
    color: '#64748B',
    fontWeight: '600',
  },
  periodTextActive: {
    color: 'white',
  },
  recordCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: scale(14),
    marginBottom: scale(10),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recordTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  serviceName: {
    fontSize: scale(14),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  recordMeta: {
    fontSize: scale(12),
    color: '#64748B',
    marginTop: 2,
  },
  recordNet: {
    fontSize: scale(16),
    fontWeight: 'bold',
    color: '#16A34A',
  },
  recordBreakdown: {
    flexDirection: 'row',
    gap: 12,
    marginTop: scale(8),
    paddingTop: scale(8),
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  breakdownItem: {
    fontSize: scale(11),
    color: '#64748B',
  },
});
