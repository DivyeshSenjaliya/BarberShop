import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useToast } from '../components/ToastContext';
import { apiClient } from '../api';
import type { NotificationItem } from '../api';

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    userId: 'usr-customer-1',
    title: 'Appointment Reminder',
    message: 'Your haircut with Marcus Vance is scheduled for tomorrow at 10:00 AM.',
    type: 'reminder',
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'notif-2',
    userId: 'usr-customer-1',
    title: 'Booking Confirmed!',
    message: 'Appointment BS-884129 at The Royal Sovereign Barber Co. has been confirmed.',
    type: 'booking',
    isRead: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'notif-3',
    userId: 'usr-customer-1',
    title: 'Weekend Special: 15% Off',
    message: 'Use promo code WEEKEND15 on any grooming package this Saturday!',
    type: 'promotion',
    isRead: true,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'notif-4',
    userId: 'usr-customer-1',
    title: 'Payment Successful',
    message: 'Receipt for $48.60 has been sent to your email for booking BS-884129.',
    type: 'payment',
    isRead: true,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];

const NotificationCenter = ({ navigation }: any) => {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [prefModalVisible, setPrefModalVisible] = useState<boolean>(false);

  // Preference Toggles
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(true);
  const [promotionsEnabled, setPromotionsEnabled] = useState<boolean>(true);
  const [receiptsEnabled, setReceiptsEnabled] = useState<boolean>(true);
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);

  useEffect(() => {
    async function loadNotifications() {
      setIsLoading(true);
      try {
        const fetched = await apiClient.notifications.list();
        if (fetched && fetched.length > 0) {
          setNotifications(fetched);
        }
      } catch {
        // Keep mock data for offline demo
      } finally {
        setIsLoading(false);
      }
    }
    loadNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await apiClient.notifications.markAsRead(id);
    } catch {
      // Local state already updated
    }
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    showToast('All notifications marked as read', { type: 'info' });
  };

  const getTypeIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'reminder':
        return '⏰';
      case 'booking':
        return '📅';
      case 'payment':
        return '💳';
      case 'promotion':
        return '🏷️';
      default:
        return '🔔';
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          onPress={() => setPrefModalVisible(true)}
          style={styles.prefButton}>
          <Text style={styles.prefButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Subheader with Mark All */}
      <View style={styles.subHeader}>
        <Text style={styles.unreadCountText}>
          {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Color.Primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySubtitle}>You are all caught up!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
              onPress={() => handleMarkAsRead(item.id)}
              activeOpacity={0.8}>
              <View style={styles.iconCircle}>
                <Text style={styles.typeIcon}>{getTypeIcon(item.type)}</Text>
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifTop}>
                  <Text style={[styles.notifTitle, !item.isRead && styles.notifTitleBold]}>
                    {item.title}
                  </Text>
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notifMessage}>{item.message}</Text>
                <Text style={styles.notifTime}>
                  {new Date(item.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Preferences Modal */}
      <Modal visible={prefModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Notification Settings</Text>
            <Text style={styles.modalSubtitle}>Customize which notifications you receive:</Text>

            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefLabel}>Appointment Reminders</Text>
                <Text style={styles.prefDesc}>24 hours and 2 hours before booking</Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
                trackColor={{ true: Color.Primary, false: '#E2E8F0' }}
              />
            </View>

            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefLabel}>Special Offers & Promos</Text>
                <Text style={styles.prefDesc}>Discounts and holiday specials</Text>
              </View>
              <Switch
                value={promotionsEnabled}
                onValueChange={setPromotionsEnabled}
                trackColor={{ true: Color.Primary, false: '#E2E8F0' }}
              />
            </View>

            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefLabel}>Payment Receipts</Text>
                <Text style={styles.prefDesc}>Invoices and refund notices</Text>
              </View>
              <Switch
                value={receiptsEnabled}
                onValueChange={setReceiptsEnabled}
                trackColor={{ true: Color.Primary, false: '#E2E8F0' }}
              />
            </View>

            <View style={styles.prefRow}>
              <View style={styles.prefTextContainer}>
                <Text style={styles.prefLabel}>Push Notifications</Text>
                <Text style={styles.prefDesc}>Deliver alerts directly to lock screen</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ true: Color.Primary, false: '#E2E8F0' }}
              />
            </View>

            <TouchableOpacity
              style={styles.closePrefButton}
              onPress={() => {
                setPrefModalVisible(false);
                showToast('Notification preferences saved', { type: 'success' });
              }}>
              <Text style={styles.closePrefText}>Save & Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default NotificationCenter;

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
  prefButton: {
    padding: 6,
  },
  prefButtonText: {
    fontSize: scale(20),
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  unreadCountText: {
    fontSize: scale(13),
    color: '#64748B',
    fontWeight: '500',
  },
  markAllText: {
    fontSize: scale(13),
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
  notifCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: scale(14),
    marginBottom: scale(10),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifCardUnread: {
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  iconCircle: {
    height: scale(40),
    width: scale(40),
    borderRadius: scale(20),
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: scale(18),
  },
  notifContent: {
    flex: 1,
    marginLeft: scale(12),
  },
  notifTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: scale(14),
    color: '#1E293B',
    fontWeight: '500',
  },
  notifTitleBold: {
    fontWeight: 'bold',
    color: '#0F172A',
  },
  unreadDot: {
    height: scale(8),
    width: scale(8),
    borderRadius: scale(4),
    backgroundColor: '#0284C7',
  },
  notifMessage: {
    fontSize: scale(13),
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: scale(11),
    color: '#94A3B8',
    marginTop: 6,
  },
  emptyContainer: {
    paddingTop: scale(80),
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: scale(16),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: scale(13),
    color: '#64748B',
    marginTop: 4,
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
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  prefTextContainer: {
    flex: 1,
    paddingRight: scale(10),
  },
  prefLabel: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#0F172A',
  },
  prefDesc: {
    fontSize: scale(12),
    color: '#64748B',
    marginTop: 2,
  },
  closePrefButton: {
    backgroundColor: Color.Primary,
    marginTop: scale(20),
    paddingVertical: scale(12),
    borderRadius: 20,
    alignItems: 'center',
  },
  closePrefText: {
    color: 'white',
    fontSize: scale(14),
    fontWeight: 'bold',
  },
});
