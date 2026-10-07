import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii, shadows } from '../theme';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const id = Math.random().toString(36).substring(7);
    const type = options?.type ?? 'info';
    const duration = options?.duration ?? 3500;

    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={styles.toastContainer} pointerEvents="none">
        {toasts.map((toast) => (
          <View key={toast.id} style={[styles.toast, styles[toast.type]]}>
            <Text style={[styles.toastText, textStyles[toast.type]]}>{toast.message}</Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: spacing.base,
    right: spacing.base,
    zIndex: 9999,
    alignItems: 'center',
    gap: spacing.sm,
  },
  toast: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radii.base,
    borderWidth: 1,
    minWidth: 260,
    maxWidth: '90%',
    ...shadows.modal,
  },
  toastText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.subtext,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  success: {
    backgroundColor: colors.status.successBg,
    borderColor: colors.status.success,
  },
  error: {
    backgroundColor: colors.status.errorBg,
    borderColor: colors.status.error,
  },
  info: {
    backgroundColor: colors.status.infoBg,
    borderColor: colors.status.info,
  },
  warning: {
    backgroundColor: colors.status.warningBg,
    borderColor: colors.status.warning,
  },
});

const textStyles = StyleSheet.create({
  success: {
    color: colors.status.successLight,
  },
  error: {
    color: colors.status.errorLight,
  },
  info: {
    color: colors.status.infoLight,
  },
  warning: {
    color: colors.status.warningLight,
  },
});
