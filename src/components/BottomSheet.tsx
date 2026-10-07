import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  style,
  testID = 'bottom-sheet',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <TouchableWithoutFeedback onPress={onClose} testID={`${testID}-backdrop`}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, style]} testID={`${testID}-content`}>
              <View style={styles.handleBar} />

              {(title || subtitle) && (
                <View style={styles.header}>
                  <View style={styles.headerTextContainer}>
                    {title && <Text style={styles.title}>{title}</Text>}
                    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                  </View>
                  <TouchableOpacity
                    testID={`${testID}-close`}
                    onPress={onClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.closeButton}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.body}>{children}</View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.cardBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    fontSize: 18,
    color: colors.textSecondary,
    marginLeft: 12,
  },
  body: {
    width: '100%',
  },
});
