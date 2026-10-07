import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { scale } from '../utilits/Scale';
import { Color } from '../constants/Color';
import { useToast } from '../components/ToastContext';

interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  ownerReply?: string;
}

const MOCK_REVIEWS: ReviewItem[] = [
  {
    id: 'rev-1',
    author: 'James Henderson',
    rating: 5,
    date: '2 days ago',
    comment:
      'Marcus did an unbelievable skin fade! Sharp lines and zero irritation. The complimentary hot towel and espresso were top notch.',
    ownerReply: 'Thank you James! Always a pleasure having you at The Royal Sovereign.',
  },
  {
    id: 'rev-2',
    author: 'David Chen',
    rating: 5,
    date: '1 week ago',
    comment: 'Best beard trim in the city. Great atmosphere, clean tools, and on-time service.',
  },
  {
    id: 'rev-3',
    author: 'Lucas Miller',
    rating: 4,
    date: '2 weeks ago',
    comment: 'Very professional barbers. Slight wait time during peak Saturday, but the haircut was worth it.',
  },
];

const AMENITIES = [
  '📶 Fast Wi-Fi',
  '☕ Premium Coffee',
  '🚗 Free Parking',
  '❄️ Air Conditioned',
  '💳 Card Accepted',
  '👶 Kid Friendly',
];

const BUSINESS_HOURS = [
  { day: 'Monday – Friday', hours: '09:00 AM – 08:00 PM' },
  { day: 'Saturday', hours: '09:00 AM – 06:00 PM' },
  { day: 'Sunday', hours: '10:00 AM – 04:00 PM' },
];

const ShopDetail = ({ navigation, route }: any) => {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<ReviewItem[]>(MOCK_REVIEWS);
  const [writeReviewVisible, setWriteReviewVisible] = useState<boolean>(false);
  const [newRating, setNewRating] = useState<number>(5);
  const [newComment, setNewComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const shopName = route?.params?.shopName || 'The Royal Sovereign Barber Co.';
  const shopAddress = route?.params?.address || '142 King Street West, Suite 200';
  const shopId = route?.params?.shopId || 'shop-1';

  const handleAddReview = () => {
    if (!newComment.trim()) {
      showToast('Please enter your review comments', { type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const newEntry: ReviewItem = {
        id: `rev-${Date.now()}`,
        author: 'You',
        rating: newRating,
        date: 'Just now',
        comment: newComment.trim(),
      };
      setReviews([newEntry, ...reviews]);
      setWriteReviewVisible(false);
      setNewComment('');
      showToast('Review posted successfully!', { type: 'success' });
    }, 400);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Image source={require('../assests/icon/arrow.png')} style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {shopName}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner Card */}
        <View style={styles.shopOverviewCard}>
          <Text style={styles.shopTitle}>{shopName}</Text>
          <Text style={styles.shopLocation}>📍 {shopAddress}</Text>
          <View style={styles.ratingsRow}>
            <Text style={styles.starBadge}>★ 4.9</Text>
            <Text style={styles.ratingCount}>({reviews.length * 42} Google & App reviews)</Text>
            <View style={styles.openNowBadge}>
              <Text style={styles.openNowText}>Open Now</Text>
            </View>
          </View>
        </View>

        {/* Amenities Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Shop Amenities</Text>
          <View style={styles.amenitiesGrid}>
            {AMENITIES.map((item) => (
              <View key={item} style={styles.amenityChip}>
                <Text style={styles.amenityText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Business Hours */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Business Hours</Text>
          <View style={styles.hoursContainer}>
            {BUSINESS_HOURS.map((h) => (
              <View key={h.day} style={styles.hourRow}>
                <Text style={styles.hourDay}>{h.day}</Text>
                <Text style={styles.hourTime}>{h.hours}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Customer Reviews Section */}
        <View style={styles.sectionCard}>
          <View style={styles.reviewsHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Verified Reviews</Text>
              <Text style={styles.reviewsSummary}>Rated 4.9 out of 5 stars</Text>
            </View>
            <TouchableOpacity
              style={styles.writeReviewButton}
              onPress={() => setWriteReviewVisible(true)}>
              <Text style={styles.writeReviewButtonText}>+ Write Review</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reviewsList}>
            {reviews.map((rev) => (
              <View key={rev.id} style={styles.reviewCard}>
                <View style={styles.reviewTopRow}>
                  <Text style={styles.reviewAuthor}>{rev.author}</Text>
                  <Text style={styles.reviewDate}>{rev.date}</Text>
                </View>
                <Text style={styles.reviewStars}>{'★'.repeat(rev.rating)}</Text>
                <Text style={styles.reviewComment}>{rev.comment}</Text>

                {rev.ownerReply && (
                  <View style={styles.ownerReplyBox}>
                    <Text style={styles.ownerReplyHeading}>Response from Owner:</Text>
                    <Text style={styles.ownerReplyText}>{rev.ownerReply}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Book Appointment CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bookCtaButton}
          onPress={() => navigation.navigate('Services', { shopId })}>
          <Text style={styles.bookCtaText}>Book Appointment with Barber →</Text>
        </TouchableOpacity>
      </View>

      {/* Write Review Modal */}
      <Modal visible={writeReviewVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave a Review</Text>
            <Text style={styles.modalSubtitle}>How was your cut and service?</Text>

            <View style={styles.starsPicker}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setNewRating(star)}>
                  <Text style={[styles.starIcon, star <= newRating && styles.starIconActive]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Share details about the barber, fade, punctuality..."
              placeholderTextColor="#94A3B8"
              value={newComment}
              onChangeText={setNewComment}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setWriteReviewVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmit}
                onPress={handleAddReview}
                disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Post Review</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ShopDetail;

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
    fontSize: scale(17),
    fontWeight: 'bold',
    color: '#0F172A',
    flex: 1,
    textAlign: 'center',
  },
  headerRightPlaceholder: {
    width: scale(32),
  },
  scrollContent: {
    padding: scale(16),
    paddingBottom: scale(100),
    gap: scale(12),
  },
  shopOverviewCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: scale(18),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shopTitle: {
    fontSize: scale(20),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  shopLocation: {
    fontSize: scale(13),
    color: '#64748B',
    marginTop: 4,
  },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(12),
    gap: 8,
  },
  starBadge: {
    backgroundColor: '#FEF3C7',
    color: '#D97706',
    fontWeight: 'bold',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: 6,
    fontSize: scale(12),
  },
  ratingCount: {
    fontSize: scale(12),
    color: '#64748B',
  },
  openNowBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: 6,
    marginLeft: 'auto',
  },
  openNowText: {
    fontSize: scale(11),
    fontWeight: 'bold',
    color: '#16A34A',
  },
  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: scale(16),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeading: {
    fontSize: scale(15),
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: scale(10),
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: 8,
  },
  amenityText: {
    fontSize: scale(12),
    color: '#334155',
    fontWeight: '500',
  },
  hoursContainer: {
    gap: 8,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hourDay: {
    fontSize: scale(13),
    color: '#475569',
  },
  hourTime: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#0F172A',
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(14),
  },
  reviewsSummary: {
    fontSize: scale(12),
    color: '#64748B',
    marginTop: 2,
  },
  writeReviewButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: 8,
  },
  writeReviewButtonText: {
    color: Color.Primary,
    fontSize: scale(12),
    fontWeight: 'bold',
  },
  reviewsList: {
    gap: scale(12),
  },
  reviewCard: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: scale(10),
  },
  reviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewAuthor: {
    fontSize: scale(13),
    fontWeight: 'bold',
    color: '#0F172A',
  },
  reviewDate: {
    fontSize: scale(11),
    color: '#94A3B8',
  },
  reviewStars: {
    color: '#F59E0B',
    fontSize: scale(14),
    marginTop: 2,
  },
  reviewComment: {
    fontSize: scale(13),
    color: '#334155',
    marginTop: 4,
    lineHeight: 18,
  },
  ownerReplyBox: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: Color.Primary,
    padding: scale(8),
    borderRadius: 4,
    marginTop: scale(8),
  },
  ownerReplyHeading: {
    fontSize: scale(11),
    fontWeight: 'bold',
    color: Color.Primary,
  },
  ownerReplyText: {
    fontSize: scale(12),
    color: '#475569',
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  bookCtaButton: {
    backgroundColor: Color.Primary,
    height: scale(48),
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookCtaText: {
    color: 'white',
    fontSize: scale(15),
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
  },
  starsPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: scale(14),
  },
  starIcon: {
    fontSize: scale(28),
    color: '#E2E8F0',
  },
  starIconActive: {
    color: '#F59E0B',
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: scale(10),
    fontSize: scale(13),
    color: '#0F172A',
    minHeight: scale(80),
    textAlignVertical: 'top',
    marginBottom: scale(16),
  },
  modalButtons: {
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
  modalSubmit: {
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: 8,
    backgroundColor: Color.Primary,
  },
  modalSubmitText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: scale(13),
  },
});
