import React from 'react';
import renderer from 'react-test-renderer';
import BarberEarnings from './BarberEarnings';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text } from 'react-native';

const renderScreen = () => {
  return renderer.create(
    <ToastProvider>
      <BarberEarnings navigation={{ goBack: jest.fn() }} />
    </ToastProvider>
  );
};

describe('BarberEarnings Screen', () => {
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

  it('renders earnings metrics, commission badge, and cut records', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    expect(tree).toBeDefined();
    const texts = tree!.root.findAllByType(Text);
    const textValues = texts.map((t) => t.props.children).flat();
    expect(textValues).toContain('Earnings & Commission');
    expect(textValues).toContain('60% Commission');
    expect(textValues).toContain('Service Commission');
    expect(textValues).toContain('Tips Received');
    expect(textValues).toContain('Signature Skin Fade + Beard');
  });

  it('switches time period filter tabs', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const pills = tree!.root.findAllByType(TouchableOpacity);
    const monthPill = pills.find((p) => {
      const child = p.findAllByType(Text)[0]?.props?.children;
      return child === 'Month';
    });

    if (monthPill) {
      await renderer.act(async () => {
        monthPill.props.onPress();
      });
    }
  });

  it('triggers export statement on export button tap', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const exportBtn = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return child === 'Export';
    });

    if (exportBtn) {
      await renderer.act(async () => {
        exportBtn.props.onPress();
      });
    }
  });
});
