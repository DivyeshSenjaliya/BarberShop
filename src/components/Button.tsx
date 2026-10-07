import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { colors, typography, spacing, radii } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  testID,
}) => {
  const isDisabled = disabled || loading;

  const containerStyles: ViewStyle[] = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    isDisabled ? styles.disabled : {},
    style ?? {},
  ];

  const textStyles: TextStyle[] = [
    styles.textBase,
    styles[`textSize_${size}`],
    styles[`textVariant_${variant}`],
    isDisabled ? styles.textDisabled : {},
    textStyle ?? {},
  ];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isDisabled}
      style={containerStyles}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.canvas.background : colors.brand.primary}
        />
      ) : (
        <>
          {leftIcon}
          <Text style={textStyles}>{title}</Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.base,
    gap: spacing.sm,
  },
  textBase: {
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },

  // Sizes
  size_sm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 32,
  },
  size_md: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.base,
    minHeight: 46,
  },
  size_lg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 54,
  },

  textSize_sm: {
    fontSize: typography.sizes.subtext,
    lineHeight: typography.lineHeights.subtext,
  },
  textSize_md: {
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  textSize_lg: {
    fontSize: typography.sizes.h4,
    lineHeight: typography.lineHeights.h4,
  },

  // Variants
  variant_primary: {
    backgroundColor: colors.brand.primary,
  },
  variant_secondary: {
    backgroundColor: colors.canvas.surfaceElevated,
    borderColor: colors.canvas.border,
    borderWidth: 1,
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderColor: colors.brand.primary,
    borderWidth: 1.5,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: colors.status.error,
  },

  textVariant_primary: {
    color: colors.canvas.background,
  },
  textVariant_secondary: {
    color: colors.text.primary,
  },
  textVariant_outline: {
    color: colors.brand.primary,
  },
  textVariant_ghost: {
    color: colors.text.secondary,
  },
  textVariant_danger: {
    color: colors.text.primary,
  },

  disabled: {
    opacity: 0.5,
  },
  textDisabled: {
    color: colors.text.muted,
  },
});
