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
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useToast } from '../components/ToastContext';

export interface SavedAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
  latitude: number;
  longitude: number;
}

const INITIAL_ADDRESSES: SavedAddress[] = [
  {
    id: 'addr-1',
    label: 'Home',
    street: '742 Evergreen Terrace',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62704',
    isDefault: true,
    latitude: 39.7817,
    longitude: -89.6501,
  },
  {
    id: 'addr-2',
    label: 'Work / Studio',
    street: '100 Innovation Way, Suite 400',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    isDefault: false,
    latitude: 39.799,
    longitude: -89.6436,
  },
];

const AddressesManagement = ({ navigation }: any) => {
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<SavedAddress[]>(INITIAL_ADDRESSES);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [label, setLabel] = useState<string>('Home');
  const [street, setStreet] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [stateName, setStateName] = useState<string>('');
  const [zipCode, setZipCode] = useState<string>('');
  const [isDefault, setIsDefault] = useState<boolean>(false);

  const handleOpenAdd = () => {
    setEditingId(null);
    setLabel('Home');
    setStreet('');
    setCity('');
    setStateName('');
    setZipCode('');
    setIsDefault(addresses.length === 0);
    setModalVisible(true);
  };

  const handleOpenEdit = (addr: SavedAddress) => {
    setEditingId(addr.id);
    setLabel(addr.label);
    setStreet(addr.street);
    setCity(addr.city);
    setStateName(addr.state);
    setZipCode(addr.zipCode);
    setIsDefault(addr.isDefault);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!street.trim() || !city.trim() || !zipCode.trim()) {
      showToast('Please enter street, city, and zip code', { type: 'warning' });
      return;
    }

    if (editingId) {
      setAddresses((prev) =>
        prev.map((a) => {
          if (a.id === editingId) {
            return {
              ...a,
              label: label.trim(),
              street: street.trim(),
              city: city.trim(),
              state: stateName.trim(),
              zipCode: zipCode.trim(),
              isDefault: isDefault ? true : a.isDefault,
            };
          }
          return isDefault ? { ...a, isDefault: false } : a;
        })
      );
      showToast('Address updated successfully', { type: 'success' });
    } else {
      const newAddr: SavedAddress = {
        id: `addr-${Date.now()}`,
        label: label.trim(),
        street: street.trim(),
        city: city.trim(),
        state: stateName.trim(),
        zipCode: zipCode.trim(),
        isDefault: isDefault || addresses.length === 0,
        latitude: 39.7817,
        longitude: -89.6501,
      };

      setAddresses((prev) => {
        const next = isDefault ? prev.map((a) => ({ ...a, isDefault: false })) : [...prev];
        return [newAddr, ...next];
      });
      showToast('Address added', { type: 'success' });
    }

    setModalVisible(false);
  };

  const handleSetDefault = (id: string) => {
    setAddresses((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }))
    );
    showToast('Default address updated', { type: 'info' });
  };

  const handleDelete = (id: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    showToast('Address removed', { type: 'info' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <TouchableOpacity onPress={handleOpenAdd} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No saved addresses</Text>
            <Text style={styles.emptySubtitle}>Add an address for easy mobile bookings.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.labelRow}>
                <Text style={styles.addressLabel}>{item.label}</Text>
                {item.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                  </View>
                )}
              </View>
              <View style={styles.actionIcons}>
                <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.iconBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.streetText}>{item.street}</Text>
            <Text style={styles.cityStateText}>
              {item.city}, {item.state} {item.zipCode}
            </Text>

            {!item.isDefault && (
              <TouchableOpacity
                style={styles.setDefaultBtn}
                onPress={() => handleSetDefault(item.id)}>
                <Text style={styles.setDefaultText}>Set as default</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Address' : 'New Address'}</Text>

            <TextInput
              style={styles.input}
              placeholder="Label (e.g. Home, Work, Barber Loft)"
              placeholderTextColor="#94A3B8"
              value={label}
              onChangeText={setLabel}
            />

            <TextInput
              style={styles.input}
              placeholder="Street Address"
              placeholderTextColor="#94A3B8"
              value={street}
              onChangeText={setStreet}
            />

            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 2, marginRight: 8 }]}
                placeholder="City"
                placeholderTextColor="#94A3B8"
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="State"
                placeholderTextColor="#94A3B8"
                value={stateName}
                onChangeText={setStateName}
              />
              <TextInput
                style={[styles.input, { flex: 1.5 }]}
                placeholder="Zip"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={zipCode}
                onChangeText={setZipCode}
              />
            </View>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsDefault(!isDefault)}>
              <View style={[styles.checkbox, isDefault && styles.checkboxActive]}>
                {isDefault && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Make this my default address</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AddressesManagement;

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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressLabel: {
    fontSize: scale(15),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  defaultBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: scale(10),
    fontWeight: 'bold',
    color: '#16A34A',
  },
  actionIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    padding: 4,
  },
  editBtnText: {
    fontSize: scale(12),
    color: Color.Primary,
    fontWeight: '600',
  },
  deleteBtnText: {
    fontSize: scale(12),
    color: '#EF4444',
    fontWeight: '600',
  },
  streetText: {
    fontSize: scale(14),
    color: '#334155',
    lineHeight: 20,
  },
  cityStateText: {
    fontSize: scale(13),
    color: '#64748B',
    marginTop: 2,
  },
  setDefaultBtn: {
    marginTop: scale(12),
    paddingTop: scale(8),
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  setDefaultText: {
    fontSize: scale(12),
    color: '#64748B',
    fontWeight: '600',
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
    marginBottom: scale(16),
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: scale(10),
  },
  checkbox: {
    height: scale(20),
    width: scale(20),
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(10),
  },
  checkboxActive: {
    backgroundColor: Color.Primary,
    borderColor: Color.Primary,
  },
  checkmark: {
    color: 'white',
    fontSize: scale(12),
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: scale(13),
    color: '#475569',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: scale(16),
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
