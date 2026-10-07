import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, typography, spacing, radii } from '../theme';

export type BadgeVariant =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'active'
  | 'draft'
  | 'gold';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'confirmed', style }) => {
  return (
    <View style={[styles.badge, styles[variant], style]}>
      <Text style={[styles.text, textStyles[variant]]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
  },
  pending: {
    backgroundColor: colors.status.warningBg,
  },
  confirmed: {
    backgroundColor: colors.status.infoBg,
  },
  in_progress: {
    backgroundColor: '#2A1B4E',
  },
  completed: {
    backgroundColor: colors.status.successBg,
  },
  cancelled: {
    backgroundColor: colors.status.errorBg,
  },
  no_show: {
    backgroundColor: colors.canvas.surfaceElevated,
  },
  active: {
    backgroundColor: colors.status.successBg,
  },
  draft: {
    backgroundColor: colors.canvas.surfaceElevated,
  },
  gold: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
});

const textStyles = StyleSheet.create({
  pending: {
    color: colors.status.warning,
  },
  confirmed: {
    color: colors.status.info,
  },
  in_progress: {
    color: '#A371F7',
  },
  completed: {
    color: colors.status.success,
  },
  cancelled: {
    color: colors.status.error,
  },
  no_show: {
    color: colors.text.muted,
  },
  active: {
    color: colors.status.success,
  },
  draft: {
    color: colors.text.secondary,
  },
  gold: {
    color: colors.brand.primary,
  },
});
