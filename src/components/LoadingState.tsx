import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';
import { colors, typography, spacing } from '../theme';

export interface LoadingStateProps {
  message?: string;
  style?: ViewStyle;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading...', style }) => {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={colors.brand.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  message: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
