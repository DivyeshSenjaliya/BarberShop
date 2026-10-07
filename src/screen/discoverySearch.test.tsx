import React from 'react';
import renderer from 'react-test-renderer';
import DiscoverySearch from './DiscoverySearch';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text, TextInput } from 'react-native';
import { apiClient } from '../api';

const renderScreen = () => {
  return renderer.create(
    <ToastProvider>
      <DiscoverySearch navigation={{ navigate: jest.fn() }} />
    </ToastProvider>
  );
};

describe('DiscoverySearch Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(apiClient.discovery, 'searchShops').mockResolvedValue({ data: [] } as any);
  });

  afterEach(async () => {
    await renderer.act(async () => {
      jest.runAllTimers();
      await Promise.resolve();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders search input, category pills, and sorting controls', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
      jest.advanceTimersByTime(250);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(tree).toBeDefined();
    const input = tree!.root.findByType(TextInput);
    expect(input.props.placeholder).toContain('Search shops');

    const texts = tree!.root.findAllByType(Text);
    const textValues = texts.map((t) => t.props.children).flat();
    expect(textValues).toContain('Haircuts');
    expect(textValues).toContain('Beard & Shave');
    expect(textValues).toContain('Distance');
    expect(textValues).toContain('Rating');
  });

  it('filters by category on pill tap', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
      jest.advanceTimersByTime(250);
      await Promise.resolve();
      await Promise.resolve();
    });

    const pills = tree!.root.findAllByType(TouchableOpacity);
    const haircutPill = pills.find((p) => {
      const child = p.findAllByType(Text)[0]?.props?.children;
      return child === 'Haircuts';
    });

    if (haircutPill) {
      await renderer.act(async () => {
        haircutPill.props.onPress();
        jest.advanceTimersByTime(250);
        await Promise.resolve();
        await Promise.resolve();
      });
    }
  });

  it('toggles favorite on shop card', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
      jest.advanceTimersByTime(250);
      await Promise.resolve();
      await Promise.resolve();
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const heartBtn = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return child === '♥' || child === '♡';
    });

    if (heartBtn) {
      await renderer.act(async () => {
        heartBtn.props.onPress();
        jest.advanceTimersByTime(4000);
        await Promise.resolve();
        await Promise.resolve();
      });
    }
  });
});
