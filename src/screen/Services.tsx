import React, { useState, useEffect } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { Service as DefaultServices } from '../constants/Services';
import { useBooking } from '../context/BookingContext';
import { apiClient } from '../api';
import type { Service as ApiService } from '../api';
import { colors, radii, spacing } from '../theme';

const Services = ({ navigation, route }: any) => {
  const { services: selectedServices, toggleService, pricing, setShop } = useBooking();
  const [catalog, setCatalog] = useState<ApiService[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const shopId = route?.params?.shopId || 'shop-main';

  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const fetched = await apiClient.catalog.getServices(shopId);
        if (isMounted && fetched && fetched.length > 0) {
          setCatalog(fetched);
          return;
        }
      } catch {
        // Fallback to default catalog items if local backend is offline
      }

      if (isMounted) {
        // Map local default static services into ApiService structure
        const mapped = DefaultServices.map((item) => ({
          id: String(item.id),
          shopId: shopId,
          name: item.Name,
          durationMinutes: parseInt(item.Time, 10) || 30,
          priceCents: Math.round(parseFloat(item.Price.replace('$', '')) * 100) || 3500,
          currency: 'USD',
          status: 'active' as const,
        }));
        setCatalog(mapped);
      }
      if (isMounted) {
        setIsLoading(false);
      }
    }

    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [shopId]);

  const filteredCatalog = catalog.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSelected = (serviceId: string) => {
    return selectedServices.some((s) => s.id === serviceId);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image
            source={require('../assests/icon/arrow.png')}
            style={styles.backIcon}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Services</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Color.Primary} />
          <Text style={styles.loadingText}>Loading service catalog...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCatalog}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const selected = isSelected(item.id);
            return (
              <TouchableOpacity
                style={[styles.serviceCard, selected && styles.serviceCardSelected]}
                onPress={() => toggleService(item)}
                activeOpacity={0.7}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{item.name}</Text>
                  <Text style={styles.serviceMeta}>
                    {item.durationMinutes} mins • ${(item.priceCents / 100).toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.selectBadge, selected && styles.selectBadgeActive]}>
                  <Text style={[styles.selectBadgeText, selected && styles.selectBadgeTextActive]}>
                    {selected ? '✓ Added' : '+ Add'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {selectedServices.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarTextContainer}>
            <Text style={styles.bottomBarCount}>
              {selectedServices.length} {selectedServices.length === 1 ? 'service' : 'services'} selected
            </Text>
            <Text style={styles.bottomBarTotal}>
              ${(pricing.subtotalCents / 100).toFixed(2)} • {pricing.durationMinutes} mins
            </Text>
          </View>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => navigation.navigate('SelectProfessional')}>
            <Text style={styles.continueButtonText}>Select Barber →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default Services;

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 14,
  },
  listContent: {
    padding: scale(16),
    paddingBottom: scale(90),
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: scale(16),
    borderRadius: 12,
    marginBottom: scale(12),
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  serviceCardSelected: {
    borderColor: Color.Primary,
    backgroundColor: '#F0FDF4',
  },
  serviceInfo: {
    flex: 1,
    paddingRight: scale(10),
  },
  serviceName: {
    fontSize: scale(16),
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  serviceMeta: {
    fontSize: scale(13),
    color: '#64748B',
  },
  selectBadge: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  selectBadgeActive: {
    backgroundColor: Color.Primary,
  },
  selectBadgeText: {
    fontSize: scale(12),
    fontWeight: '600',
    color: '#475569',
  },
  selectBadgeTextActive: {
    color: 'white',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },
  bottomBarTextContainer: {
    flex: 1,
  },
  bottomBarCount: {
    fontSize: scale(13),
    color: '#64748B',
  },
  bottomBarTotal: {
    fontSize: scale(16),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  continueButton: {
    backgroundColor: Color.Primary,
    paddingHorizontal: scale(20),
    paddingVertical: scale(12),
    borderRadius: 24,
  },
  continueButtonText: {
    color: 'white',
    fontSize: scale(14),
    fontWeight: 'bold',
  },
});