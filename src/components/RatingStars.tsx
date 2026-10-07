import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

export interface RatingStarsProps {
  rating: number; // e.g. 4.5
  maxRating?: number; // default 5
  size?: number; // font size for stars
  showValue?: boolean;
  reviewsCount?: number;
  onRate?: (rating: number) => void;
  style?: ViewStyle;
  testID?: string;
}

export const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  maxRating = 5,
  size = 16,
  showValue = false,
  reviewsCount,
  onRate,
  style,
  testID = 'rating-stars',
}) => {
  const isInteractive = typeof onRate === 'function';

  const stars = [];
  for (let i = 1; i <= maxRating; i++) {
    const isFull = rating >= i;
    const isHalf = !isFull && rating >= i - 0.5;

    const starChar = isFull ? '★' : isHalf ? '★' : '☆';
    const starColor = isFull || isHalf ? '#F59E0B' : colors.cardBorder;

    if (isInteractive) {
      stars.push(
        <TouchableOpacity
          key={i}
          testID={`${testID}-star-${i}`}
          accessibilityRole="button"
          accessibilityLabel={`Rate ${i} of ${maxRating} stars`}
          onPress={() => onRate(i)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={[styles.star, { fontSize: size, color: starColor }]}>{starChar}</Text>
        </TouchableOpacity>,
      );
    } else {
      stars.push(
        <Text key={i} testID={`${testID}-star-${i}`} style={[styles.star, { fontSize: size, color: starColor }]}>
          {starChar}
        </Text>,
      );
    }
  }

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.starsRow}>{stars}</View>
      {showValue && (
        <Text testID={`${testID}-value`} style={[styles.valueText, { fontSize: size * 0.9 }]}>
          {rating.toFixed(1)}
        </Text>
      )}
      {typeof reviewsCount === 'number' && (
        <Text testID={`${testID}-count`} style={[styles.countText, { fontSize: size * 0.8 }]}>
          ({reviewsCount})
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginRight: 2,
  },
  valueText: {
    marginLeft: 6,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  countText: {
    marginLeft: 4,
    color: colors.textSecondary,
  },
});
