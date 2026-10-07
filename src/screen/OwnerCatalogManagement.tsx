import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useToast } from '../components/ToastContext';

interface EditableService {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  category: string;
  isActive: boolean;
}

interface EditableStaff {
  id: string;
  name: string;
  role: string;
  commissionPercent: number;
  status: 'active' | 'on_leave' | 'inactive';
}

const INITIAL_SERVICES: EditableService[] = [
  { id: 's-1', name: 'Signature Skin Fade', durationMinutes: 45, priceCents: 4500, category: 'Haircuts', isActive: true },
  { id: 's-2', name: 'Hot Towel Razor Shave', durationMinutes: 30, priceCents: 3000, category: 'Shave', isActive: true },
  { id: 's-3', name: 'Beard Sculpting & Lineup', durationMinutes: 20, priceCents: 2000, category: 'Beard', isActive: true },
  { id: 's-4', name: 'Executive Grooming Package', durationMinutes: 75, priceCents: 8500, category: 'Packages', isActive: true },
  { id: 's-5', name: 'Hair Color & Highlights', durationMinutes: 90, priceCents: 11000, category: 'Color', isActive: false },
];

const INITIAL_STAFF: EditableStaff[] = [
  { id: 'stf-1', name: 'Marcus Vance', role: 'Master Barber', commissionPercent: 60, status: 'active' },
  { id: 'stf-2', name: 'Derrick Hayes', role: 'Senior Stylist', commissionPercent: 55, status: 'active' },
  { id: 'stf-3', name: 'Leo Romero', role: 'Barber', commissionPercent: 50, status: 'active' },
];

const OwnerCatalogManagement = ({ navigation }: any) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'services' | 'staff'>('services');
  const [services, setServices] = useState<EditableService[]>(INITIAL_SERVICES);
  const [staff, setStaff] = useState<EditableStaff[]>(INITIAL_STAFF);

  // Add Service Modal
  const [serviceModalVisible, setServiceModalVisible] = useState<boolean>(false);
  const [serviceName, setServiceName] = useState<string>('');
  const [serviceDuration, setServiceDuration] = useState<string>('30');
  const [servicePrice, setServicePrice] = useState<string>('35.00');
  const [serviceCategory, setServiceCategory] = useState<string>('Haircuts');

  // Add Staff Modal
  const [staffModalVisible, setStaffModalVisible] = useState<boolean>(false);
  const [staffName, setStaffName] = useState<string>('');
  const [staffRole, setStaffRole] = useState<string>('Barber');
  const [staffCommission, setStaffCommission] = useState<string>('50');

  const handleToggleService = (id: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
    showToast('Service availability updated', { type: 'info' });
  };

  const handleSaveService = () => {
    if (!serviceName.trim() || !servicePrice.trim()) {
      showToast('Please enter service name and price', { type: 'warning' });
      return;
    }

    const priceCents = Math.round(parseFloat(servicePrice) * 100);
    const duration = parseInt(serviceDuration, 10) || 30;

    const newSvc: EditableService = {
      id: `s-${Date.now()}`,
      name: serviceName.trim(),
      durationMinutes: duration,
      priceCents,
      category: serviceCategory,
      isActive: true,
    };

    setServices([newSvc, ...services]);
    setServiceModalVisible(false);
    setServiceName('');
    showToast('New service added to catalog', { type: 'success' });
  };

  const handleSaveStaff = () => {
    if (!staffName.trim()) {
      showToast('Please enter staff name', { type: 'warning' });
      return;
    }

    const newMember: EditableStaff = {
      id: `stf-${Date.now()}`,
      name: staffName.trim(),
      role: staffRole,
      commissionPercent: parseInt(staffCommission, 10) || 50,
      status: 'active',
    };

    setStaff([newMember, ...staff]);
    setStaffModalVisible(false);
    setStaffName('');
    showToast('Staff member added to roster', { type: 'success' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shop Catalog & Roster</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => (activeTab === 'services' ? setServiceModalVisible(true) : setStaffModalVisible(true))}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'services' && styles.tabItemActive]}
          onPress={() => setActiveTab('services')}>
          <Text style={[styles.tabText, activeTab === 'services' && styles.tabTextActive]}>
            Services ({services.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'staff' && styles.tabItemActive]}
          onPress={() => setActiveTab('staff')}>
          <Text style={[styles.tabText, activeTab === 'staff' && styles.tabTextActive]}>
            Staff Roster ({staff.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'services' ? (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.durationMinutes} mins • ${(item.priceCents / 100).toFixed(2)} • {item.category}
                </Text>
              </View>
              <Switch
                value={item.isActive}
                onValueChange={() => handleToggleService(item.id)}
                trackColor={{ true: Color.Primary, false: '#E2E8F0' }}
              />
            </View>
          )}
        />
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.role} • {item.commissionPercent}% Commission
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Add Service Modal */}
      <Modal visible={serviceModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add New Service</Text>

            <TextInput
              style={styles.input}
              placeholder="Service Name (e.g. Deluxe Beard Care)"
              placeholderTextColor="#94A3B8"
              value={serviceName}
              onChangeText={setServiceName}
            />

            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Duration (mins)"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={serviceDuration}
                onChangeText={setServiceDuration}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Price ($ USD)"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                value={servicePrice}
                onChangeText={setServicePrice}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Category (e.g. Haircuts, Beard)"
              placeholderTextColor="#94A3B8"
              value={serviceCategory}
              onChangeText={setServiceCategory}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setServiceModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveService}>
                <Text style={styles.saveBtnText}>Save Service</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Staff Modal */}
      <Modal visible={staffModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Staff Member</Text>

            <TextInput
              style={styles.input}
              placeholder="Full Name (e.g. Alex Morgan)"
              placeholderTextColor="#94A3B8"
              value={staffName}
              onChangeText={setStaffName}
            />

            <TextInput
              style={styles.input}
              placeholder="Title / Role (e.g. Barber, Senior Barber)"
              placeholderTextColor="#94A3B8"
              value={staffRole}
              onChangeText={setStaffRole}
            />

            <TextInput
              style={styles.input}
              placeholder="Commission % (e.g. 60)"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={staffCommission}
              onChangeText={setStaffCommission}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setStaffModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveStaff}>
                <Text style={styles.saveBtnText}>Save Barber</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default OwnerCatalogManagement;

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
  addButton: {
    backgroundColor: Color.Primary,
    paddingHorizontal: scale(14),
    paddingVertical: scale(6),
    borderRadius: 14,
  },
  addButtonText: {
    color: 'white',
    fontSize: scale(13),
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: scale(12),
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Color.Primary,
  },
  tabText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: Color.Primary,
    fontWeight: 'bold',
  },
  listContent: {
    padding: scale(16),
    paddingBottom: scale(40),
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: scale(14),
    marginBottom: scale(10),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardInfo: {
    flex: 1,
    paddingRight: scale(12),
  },
  itemName: {
    fontSize: scale(15),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  itemMeta: {
    fontSize: scale(12),
    color: '#64748B',
    marginTop: 3,
  },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#16A34A',
    fontWeight: 'bold',
    fontSize: scale(10),
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
    fontSize: scale(17),
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: scale(14),
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    fontSize: scale(13),
    color: '#0F172A',
    marginBottom: scale(10),
  },
  row: {
    flexDirection: 'row',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: scale(14),
  },
  cancelBtn: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: scale(13),
  },
  saveBtn: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: 8,
    backgroundColor: Color.Primary,
  },
  saveBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: scale(13),
  },
});
