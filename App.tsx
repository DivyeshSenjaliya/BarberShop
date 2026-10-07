import React from 'react';
import { View, StyleSheet } from 'react-native';
import Navigation from './src/navigator/Navigation';
import { AuthProvider } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { ToastProvider } from './src/components/ToastContext';
import { colors } from './src/theme';

const App: React.FC = () => {
  return (
    <View style={styles.root}>
      <AuthProvider>
        <BookingProvider>
          <ToastProvider>
            <Navigation />
          </ToastProvider>
        </BookingProvider>
      </AuthProvider>
    </View>
  );
};

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
});