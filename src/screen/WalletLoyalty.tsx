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

interface LedgerItem {
  id: string;
  type: 'credit' | 'debit';
  amountCents: number;
  description: string;
  category: 'wallet' | 'loyalty';
  points?: number;
  createdAt: string;
}

const MOCK_LEDGER: LedgerItem[] = [
  {
    id: 'tx-1',
    type: 'credit',
    amountCents: 5000,
    description: 'Wallet top-up (Card ending 4242)',
    category: 'wallet',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'tx-2',
    type: 'credit',
    amountCents: 0,
    points: 150,
    description: 'Loyalty reward for completed booking BS-884129',
    category: 'loyalty',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'tx-3',
    type: 'debit',
    amountCents: 3500,
    description: 'Payment for Classic Scissor Cut (BS-712940)',
    category: 'wallet',
    createdAt: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: 'tx-4',
    type: 'debit',
    amountCents: 0,
    points: -500,
    description: 'Redeemed 500 points on booking BS-712940',
    category: 'loyalty',
    createdAt: new Date(Date.now() - 604800000).toISOString(),
  },
];

const PRESET_TOPUPS = [25, 50, 100, 200];

const WalletLoyalty = ({ navigation }: any) => {
  const { showToast } = useToast();
  const [walletBalanceCents, setWalletBalanceCents] = useState<number>(12000); // $120.00
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(1450); // 1,450 pts
  const [ledger, setLedger] = useState<LedgerItem[]>(MOCK_LEDGER);
  const [filter, setFilter] = useState<'all' | 'wallet' | 'loyalty'>('all');

  // Top Up Modal State
  const [topUpModalVisible, setTopUpModalVisible] = useState<boolean>(false);
  const [selectedTopUp, setSelectedTopUp] = useState<number>(50);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const getTier = (points: number) => {
    if (points >= 3000) return { name: 'Platinum', color: '#818CF8', target: 5000 };
    if (points >= 1500) return { name: 'Gold', color: '#F59E0B', target: 3000 };
    if (points >= 500) return { name: 'Silver', color: '#94A3B8', target: 1500 };
    return { name: 'Bronze', color: '#D97706', target: 500 };
  };

  const tier = getTier(loyaltyPoints);
  const progressPercent = Math.min(100, Math.round((loyaltyPoints / tier.target) * 100));

  const handleConfirmTopUp = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const addedCents = selectedTopUp * 100;
      setWalletBalanceCents((prev) => prev + addedCents);
      setLedger((prev) => [
        {
          id: `tx-${Date.now()}`,
          type: 'credit',
          amountCents: addedCents,
          description: `Wallet top-up ($${selectedTopUp}.00)`,
          category: 'wallet',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setTopUpModalVisible(false);
      showToast(`Successfully added $${selectedTopUp}.00 to wallet!`, { type: 'success' });
    }, 400);
  };

  const filteredLedger = filter === 'all' ? ledger : ledger.filter((item) => item.category === filter);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet & Rewards</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <FlatList
        data={filteredLedger}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {/* Wallet Balance Card */}
            <View style={styles.walletCard}>
              <View>
                <Text style={styles.walletLabel}>AVAILABLE WALLET BALANCE</Text>
                <Text style={styles.walletAmount}>${(walletBalanceCents / 100).toFixed(2)}</Text>
              </View>
              <TouchableOpacity
                style={styles.topUpButton}
                onPress={() => setTopUpModalVisible(true)}>
                <Text style={styles.topUpButtonText}>+ Add Funds</Text>
              </TouchableOpacity>
            </View>

            {/* Loyalty Points Card */}
            <View style={styles.loyaltyCard}>
              <View style={styles.loyaltyHeaderRow}>
                <View>
                  <Text style={styles.loyaltyLabel}>LOYALTY REWARD POINTS</Text>
                  <Text style={styles.loyaltyPoints}>
                    {loyaltyPoints.toLocaleString()}{' '}
                    <Text style={styles.loyaltyValue}>(${ (loyaltyPoints / 100).toFixed(2)} value)</Text>
                  </Text>
                </View>
                <View style={[styles.tierBadge, { backgroundColor: tier.color }]}>
                  <Text style={styles.tierBadgeText}>{tier.name}</Text>
                </View>
              </View>

              {/* Progress bar to next tier */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: tier.color }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {loyaltyPoints} / {tier.target} points to next tier ({progressPercent}%)
                </Text>
              </View>
            </View>

            {/* Ledger Filter Tabs */}
            <View style={styles.filterRow}>
              <Text style={styles.sectionTitle}>Transaction History</Text>
              <View style={styles.filterPills}>
                <TouchableOpacity
                  style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
                  onPress={() => setFilter('all')}>
                  <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, filter === 'wallet' && styles.filterPillActive]}
                  onPress={() => setFilter('wallet')}>
                  <Text style={[styles.filterText, filter === 'wallet' && styles.filterTextActive]}>Wallet</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, filter === 'loyalty' && styles.filterPillActive]}
                  onPress={() => setFilter('loyalty')}>
                  <Text style={[styles.filterText, filter === 'loyalty' && styles.filterTextActive]}>Points</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const isCredit = item.type === 'credit';
          const isPoints = item.category === 'loyalty';
          return (
            <View style={styles.txRow}>
              <View style={[styles.txIconCircle, { backgroundColor: isCredit ? '#DCFCE7' : '#FEE2E2' }]}>
                <Text style={[styles.txIconText, { color: isCredit ? '#16A34A' : '#DC2626' }]}>
                  {isCredit ? '↓' : '↑'}
                </Text>
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txDesc}>{item.description}</Text>
                <Text style={styles.txTime}>
                  {new Date(item.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={[styles.txAmount, { color: isCredit ? '#16A34A' : '#0F172A' }]}>
                {isCredit ? '+' : '-'}
                {isPoints
                  ? `${Math.abs(item.points || 0)} pts`
                  : `$${(item.amountCents / 100).toFixed(2)}`}
              </Text>
            </View>
          );
        }}
      />

      {/* Top Up Modal */}
      <Modal visible={topUpModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Top Up Wallet</Text>
            <Text style={styles.modalSubtitle}>Select an amount to add to your balance:</Text>

            <View style={styles.presetGrid}>
              {PRESET_TOPUPS.map((amount) => {
                const isSelected = selectedTopUp === amount;
                return (
                  <TouchableOpacity
                    key={amount}
                    style={[styles.presetCard, isSelected && styles.presetCardActive]}
                    onPress={() => setSelectedTopUp(amount)}>
                    <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                      ${amount}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setTopUpModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleConfirmTopUp}
                disabled={isProcessing}>
                {isProcessing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Pay ${selectedTopUp}.00</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default WalletLoyalty;

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
    paddingBottom: scale(40),
  },
  walletCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: scale(20),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(14),
  },
  walletLabel: {
    fontSize: scale(11),
    fontWeight: 'bold',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  walletAmount: {
    fontSize: scale(28),
    fontWeight: 'bold',
    color: 'white',
    marginTop: 4,
  },
  topUpButton: {
    backgroundColor: Color.Primary,
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    borderRadius: 20,
  },
  topUpButtonText: {
    color: 'white',
    fontSize: scale(13),
    fontWeight: 'bold',
  },
  loyaltyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: scale(18),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: scale(20),
  },
  loyaltyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  loyaltyLabel: {
    fontSize: scale(11),
    fontWeight: 'bold',
    color: '#64748B',
    letterSpacing: 1,
  },
  loyaltyPoints: {
    fontSize: scale(22),
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 4,
  },
  loyaltyValue: {
    fontSize: scale(13),
    color: '#16A34A',
    fontWeight: 'normal',
  },
  tierBadge: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(4),
    borderRadius: 12,
  },
  tierBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: scale(12),
  },
  progressContainer: {
    marginTop: scale(14),
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: scale(11),
    color: '#64748B',
    marginTop: 6,
  },
  filterRow: {
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
  filterPills: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
  },
  filterText: {
    fontSize: scale(12),
    color: '#64748B',
    fontWeight: '600',
  },
  filterTextActive: {
    color: 'white',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: scale(14),
    borderRadius: 12,
    marginBottom: scale(10),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  txIconCircle: {
    height: scale(36),
    width: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
  },
  txIconText: {
    fontSize: scale(16),
    fontWeight: 'bold',
  },
  txDetails: {
    flex: 1,
    marginLeft: scale(12),
  },
  txDesc: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#1E293B',
  },
  txTime: {
    fontSize: scale(11),
    color: '#94A3B8',
    marginTop: 2,
  },
  txAmount: {
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
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: scale(18),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: scale(13),
    color: '#64748B',
    marginTop: 4,
    marginBottom: scale(16),
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: scale(20),
  },
  presetCard: {
    width: '47%',
    paddingVertical: scale(14),
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  presetCardActive: {
    borderColor: Color.Primary,
    backgroundColor: '#F0FDF4',
  },
  presetText: {
    fontSize: scale(16),
    fontWeight: 'bold',
    color: '#334155',
  },
  presetTextActive: {
    color: Color.Primary,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: scale(13),
  },
  modalConfirm: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: 8,
    backgroundColor: Color.Primary,
  },
  modalConfirmText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: scale(13),
  },
});
