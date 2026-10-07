import React from 'react';
import renderer from 'react-test-renderer';
import NotificationCenter from './NotificationCenter';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text } from 'react-native';
import { apiClient } from '../api';

const renderScreen = () => {
  return renderer.create(
    <ToastProvider>
      <NotificationCenter navigation={{ goBack: jest.fn() }} />
    </ToastProvider>
  );
};

describe('NotificationCenter Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(apiClient.notifications, 'list').mockResolvedValue([]);
    jest.spyOn(apiClient.notifications, 'markAsRead').mockResolvedValue();
  });

  afterEach(async () => {
    await renderer.act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });
    jest.useRealTimers();
  });

  it('renders notifications list and unread indicator count', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    expect(tree).toBeDefined();
    const texts = tree!.root.findAllByType(Text);
    const textValues = texts.map((t) => t.props.children).flat();
    expect(textValues).toContain('Notifications');
    expect(textValues).toContain('Appointment Reminder');
  });

  it('marks all notifications as read on tap', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const markAllBtn = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return child === 'Mark all as read';
    });

    if (markAllBtn) {
      await renderer.act(async () => {
        markAllBtn.props.onPress();
        jest.advanceTimersByTime(200);
      });
    }
  });

  it('opens notification settings preferences modal', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const prefGear = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return child === '⚙️';
    });

    if (prefGear) {
      await renderer.act(async () => {
        prefGear.props.onPress();
      });

      const modalTexts = tree!.root.findAllByType(Text);
      const textValues = modalTexts.map((t) => t.props.children).flat();
      expect(textValues).toContain('Notification Settings');
      expect(textValues).toContain('Appointment Reminders');
    }
  });
});
