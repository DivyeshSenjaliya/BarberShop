import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'busy' | 'away' | 'offline';

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  style?: ViewStyle;
  testID?: string;
}

const SIZE_MAP: Record<AvatarSize, { dimension: number; fontSize: number; statusSize: number }> = {
  xs: { dimension: 24, fontSize: 10, statusSize: 7 },
  sm: { dimension: 32, fontSize: 13, statusSize: 9 },
  md: { dimension: 44, fontSize: 16, statusSize: 11 },
  lg: { dimension: 60, fontSize: 22, statusSize: 14 },
  xl: { dimension: 80, fontSize: 28, statusSize: 18 },
};

const STATUS_COLORS: Record<AvatarStatus, string> = {
  online: colors.success,
  busy: colors.error,
  away: colors.warning,
  offline: colors.textSecondary,
};

function getInitials(name?: string): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 'md',
  status,
  style,
  testID,
}) => {
  const { dimension, fontSize, statusSize } = SIZE_MAP[size];
  const borderRadius = dimension / 2;

  return (
    <View style={[styles.container, { width: dimension, height: dimension }, style]} testID={testID}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: dimension, height: dimension, borderRadius }}
          accessibilityRole="image"
          accessibilityLabel={name ?? 'Avatar'}
        />
      ) : (
        <View
          style={[
            styles.fallbackContainer,
            { width: dimension, height: dimension, borderRadius },
          ]}
          accessibilityRole="text"
          accessibilityLabel={name ?? 'Avatar'}
        >
          <Text style={[styles.initialsText, { fontSize }]}>{getInitials(name)}</Text>
        </View>
      )}

      {status && (
        <View
          testID={`${testID ?? 'avatar'}-status`}
          style={[
            styles.statusDot,
            {
              width: statusSize,
              height: statusSize,
              borderRadius: statusSize / 2,
              backgroundColor: STATUS_COLORS[status],
              borderWidth: statusSize > 10 ? 2 : 1.5,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackContainer: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  initialsText: {
    color: colors.primary,
    fontWeight: '700',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderColor: colors.background,
  },
});
