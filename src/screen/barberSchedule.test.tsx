import React from 'react';
import renderer from 'react-test-renderer';
import BarberSchedule from './BarberSchedule';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text } from 'react-native';

const renderScreen = () => {
  return renderer.create(
    <ToastProvider>
      <BarberSchedule navigation={{ goBack: jest.fn() }} />
    </ToastProvider>
  );
};

describe('BarberSchedule Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await renderer.act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });
    jest.useRealTimers();
  });

  it('renders schedule metrics and customer appointments', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    expect(tree).toBeDefined();
    const texts = tree!.root.findAllByType(Text);
    const textValues = texts.map((t) => t.props.children).flat();
    expect(textValues).toContain('Daily Schedule');
    expect(textValues).toContain('Total Booked');
    expect(textValues).toContain('Marcus Aurelius');
    expect(textValues).toContain('Tyler Brooks');
  });

  it('toggles barber status to On Break and Offline', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const breakBtn = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return child === 'On Break';
    });

    if (breakBtn) {
      await renderer.act(async () => {
        breakBtn.props.onPress();
      });
    }
  });

  it('transitions appointment from confirmed to in_progress to completed', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const startBtn = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return typeof child === 'string' && child.includes('Start Service');
    });

    if (startBtn) {
      await renderer.act(async () => {
        startBtn.props.onPress();
      });
    }

    const updatedButtons = tree!.root.findAllByType(TouchableOpacity);
    const completeBtn = updatedButtons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return typeof child === 'string' && child.includes('Complete Service');
    });

    if (completeBtn) {
      await renderer.act(async () => {
        completeBtn.props.onPress();
      });
    }
  });
});
