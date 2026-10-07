import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  badge?: number | string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  style?: ViewStyle;
  testID?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  selectedValue,
  onSelect,
  style,
  testID = 'segmented-control',
}: SegmentedControlProps<T>) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      {options.map((opt) => {
        const isSelected = opt.value === selectedValue;
        return (
          <TouchableOpacity
            key={opt.value}
            testID={`${testID}-opt-${opt.value}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            style={[styles.segment, isSelected && styles.segmentSelected]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]}>{opt.label}</Text>
            {opt.badge !== undefined && (
              <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                  {opt.badge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  segmentSelected: {
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: colors.cardBorder,
  },
  badgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  badgeTextSelected: {
    color: '#FFFFFF',
  },
});
