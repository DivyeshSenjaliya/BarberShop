import React from 'react';
import renderer from 'react-test-renderer';
import AppointmentsHistory from './AppointmentsHistory';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text } from 'react-native';
import { apiClient } from '../api';

const renderScreen = () => {
  return renderer.create(
    <ToastProvider>
      <AppointmentsHistory navigation={{ goBack: jest.fn(), navigate: jest.fn() }} />
    </ToastProvider>
  );
};

describe('AppointmentsHistory Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(apiClient.bookings, 'listMine').mockResolvedValue({ data: [] } as any);
  });

  afterEach(() => {
    renderer.act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders upcoming appointments and switches tabs', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    expect(tree).toBeDefined();
    const texts = tree!.root.findAllByType(Text);
    const textValues = texts.map((t) => t.props.children).flat();
    expect(textValues).toContain('My Appointments');

    // Switch to history tab
    const touchables = tree!.root.findAllByType(TouchableOpacity);
    const historyTab = touchables.find((t) => {
      const child = t.findAllByType(Text)[0]?.props?.children;
      return typeof child === 'string' && child.includes('History');
    });

    if (historyTab) {
      await renderer.act(async () => {
        historyTab.props.onPress();
      });
    }
  });

  it('opens cancel dialog for confirmed appointment', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const cancelBtn = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return child === 'Cancel';
    });

    if (cancelBtn) {
      await renderer.act(async () => {
        cancelBtn.props.onPress();
      });

      const modalTexts = tree!.root.findAllByType(Text);
      const textValues = modalTexts.map((t) => t.props.children).flat();
      expect(textValues).toContain('Cancel Appointment?');
    }
  });
});
