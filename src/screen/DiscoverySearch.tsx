import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useToast } from '../components/ToastContext';
import { apiClient } from '../api';
import type { DiscoveryShop } from '../api';

const CATEGORIES = ['All', 'Haircuts', 'Beard & Shave', 'Facial & Spa', 'Hair Color'];

const MOCK_SHOPS: DiscoveryShop[] = [
  {
    id: 'shop-1',
    name: 'The Royal Sovereign Barber Co.',
    slug: 'the-royal-sovereign',
    description: 'Bespoke grooming, traditional straight-razor cuts, complimentary espresso.',
    ownerId: 'usr-owner-1',
    status: 'active',
    ratingAverage: 4.9,
    reviewCount: 312,
    branchCount: 2,
    distanceKm: 1.4,
    featuredServices: [
      { id: 'srv-1', shopId: 'shop-1', name: 'Signature Skin Fade', durationMinutes: 45, priceCents: 4500, currency: 'USD', status: 'active' },
      { id: 'srv-2', shopId: 'shop-1', name: 'Hot Towel Razor Shave', durationMinutes: 30, priceCents: 3000, currency: 'USD', status: 'active' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'shop-2',
    name: 'Downtown Fade Lounge',
    slug: 'downtown-fade-lounge',
    description: 'Modern hip-hop aesthetic, scissor styling and beard sculpting.',
    ownerId: 'usr-owner-2',
    status: 'active',
    ratingAverage: 4.7,
    reviewCount: 185,
    branchCount: 1,
    distanceKm: 3.1,
    featuredServices: [
      { id: 'srv-3', shopId: 'shop-2', name: 'Executive Buzz & Lineup', durationMinutes: 25, priceCents: 2800, currency: 'USD', status: 'active' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'shop-3',
    name: 'Crown & Scissors Salon',
    slug: 'crown-scissors-salon',
    description: 'Luxury salon experience for men and women.',
    ownerId: 'usr-owner-3',
    status: 'active',
    ratingAverage: 4.8,
    reviewCount: 240,
    branchCount: 3,
    distanceKm: 4.8,
    featuredServices: [
      { id: 'srv-4', shopId: 'shop-3', name: 'Full Grooming Package', durationMinutes: 60, priceCents: 7500, currency: 'USD', status: 'active' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DiscoverySearch = ({ navigation }: any) => {
  const { showToast } = useToast();
  const [query, setQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'popular'>('distance');
  const [shops, setShops] = useState<DiscoveryShop[]>(MOCK_SHOPS);
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['shop-1']));
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function search() {
      setIsLoading(true);
      try {
        const response = await apiClient.discovery.searchShops({
          query: query || undefined,
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          sortBy: sortBy,
        });
        if (isMounted && response?.data && response.data.length > 0) {
          setShops(response.data);
        }
      } catch {
        // Keep mock data for demo mode
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    const timer = setTimeout(search, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query, selectedCategory, sortBy]);

  const handleToggleFavorite = async (shopId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(shopId)) {
        next.delete(shopId);
        showToast('Removed from favorites', { type: 'info' });
      } else {
        next.add(shopId);
        showToast('Saved to favorites', { type: 'success' });
      }
      return next;
    });

    try {
      await apiClient.favorites.toggle('shop', shopId);
    } catch {
      // Local state already updated
    }
  };

  return (
    <View style={styles.container}>
      {/* Header & Search Bar */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Image source={require('../assests/icon/search.png')} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search shops, barbers, services..."
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills */}
      <View style={styles.categoryRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item;
            return (
              <TouchableOpacity
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(item)}>
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Sort Options */}
      <View style={styles.sortRow}>
        <Text style={styles.resultsCount}>
          {shops.length} {shops.length === 1 ? 'barber shop' : 'barber shops'} nearby
        </Text>
        <View style={styles.sortButtons}>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'distance' && styles.sortButtonActive]}
            onPress={() => setSortBy('distance')}>
            <Text style={[styles.sortButtonText, sortBy === 'distance' && styles.sortButtonTextActive]}>
              Distance
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'rating' && styles.sortButtonActive]}
            onPress={() => setSortBy('rating')}>
            <Text style={[styles.sortButtonText, sortBy === 'rating' && styles.sortButtonTextActive]}>
              Rating
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'popular' && styles.sortButtonActive]}
            onPress={() => setSortBy('popular')}>
            <Text style={[styles.sortButtonText, sortBy === 'popular' && styles.sortButtonTextActive]}>
              Popular
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Shop List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Color.Primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isFav = favorites.has(item.id);
            return (
              <TouchableOpacity
                style={styles.shopCard}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Services', { shopId: item.id })}>
                <View style={styles.cardHeader}>
                  <View style={styles.shopMeta}>
                    <Text style={styles.shopName}>{item.name}</Text>
                    <Text style={styles.shopDistance}>
                      📍 {item.distanceKm ? `${item.distanceKm.toFixed(1)} km away` : 'Nearby'} •{' '}
                      {item.branchCount} {item.branchCount === 1 ? 'branch' : 'branches'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={() => handleToggleFavorite(item.id)}>
                    <Text style={[styles.heartIcon, isFav && styles.heartIconActive]}>
                      {isFav ? '♥' : '♡'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {item.description ? (
                  <Text style={styles.shopDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>★ {item.ratingAverage.toFixed(1)}</Text>
                    <Text style={styles.reviewCount}>({item.reviewCount})</Text>
                  </View>

                  <View style={styles.bookButton}>
                    <Text style={styles.bookButtonText}>View Services →</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

export default DiscoverySearch;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: scale(45),
    paddingBottom: scale(12),
    paddingHorizontal: scale(16),
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: scale(12),
    height: scale(44),
  },
  searchIcon: {
    height: scale(18),
    width: scale(18),
    resizeMode: 'contain',
    tintColor: '#64748B',
  },
  searchInput: {
    flex: 1,
    marginLeft: scale(10),
    fontSize: scale(14),
    color: '#0F172A',
  },
  clearText: {
    fontSize: scale(14),
    color: '#94A3B8',
    padding: 4,
  },
  categoryRow: {
    backgroundColor: 'white',
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryPill: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(6),
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: scale(8),
  },
  categoryPillActive: {
    backgroundColor: Color.Primary,
  },
  categoryText: {
    fontSize: scale(13),
    color: '#475569',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
  },
  resultsCount: {
    fontSize: scale(12),
    color: '#64748B',
    fontWeight: '500',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  sortButton: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  sortButtonActive: {
    backgroundColor: '#0F172A',
  },
  sortButtonText: {
    fontSize: scale(11),
    color: '#475569',
    fontWeight: '600',
  },
  sortButtonTextActive: {
    color: 'white',
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
  shopCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: scale(16),
    marginBottom: scale(14),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shopMeta: {
    flex: 1,
    paddingRight: scale(10),
  },
  shopName: {
    fontSize: scale(16),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  shopDistance: {
    fontSize: scale(12),
    color: '#64748B',
    marginTop: 4,
  },
  favoriteButton: {
    padding: 4,
  },
  heartIcon: {
    fontSize: scale(22),
    color: '#CBD5E1',
  },
  heartIconActive: {
    color: '#EF4444',
  },
  shopDescription: {
    fontSize: scale(13),
    color: '#475569',
    marginTop: scale(8),
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(14),
    paddingTop: scale(10),
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: 8,
  },
  ratingText: {
    fontSize: scale(12),
    fontWeight: 'bold',
    color: '#D97706',
  },
  reviewCount: {
    fontSize: scale(11),
    color: '#78350F',
    marginLeft: 3,
  },
  bookButton: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  bookButtonText: {
    fontSize: scale(12),
    fontWeight: 'bold',
    color: Color.Primary,
  },
});
