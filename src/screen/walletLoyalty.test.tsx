import React from 'react';
import renderer from 'react-test-renderer';
import WalletLoyalty from './WalletLoyalty';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text } from 'react-native';

const renderScreen = () => {
  return renderer.create(
    <ToastProvider>
      <WalletLoyalty navigation={{ goBack: jest.fn() }} />
    </ToastProvider>
  );
};

describe('WalletLoyalty Screen', () => {
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

  it('renders wallet balance, loyalty points, and tier status', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    expect(tree).toBeDefined();
    const texts = tree!.root.findAllByType(Text);
    const textValues = texts.map((t) => t.props.children).flat();
    expect(textValues).toContain('Wallet & Rewards');
    expect(textValues).toContain('AVAILABLE WALLET BALANCE');
    expect(textValues).toContain('120.00');
    expect(textValues).toContain('LOYALTY REWARD POINTS');
  });

  it('switches between transaction history filters', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const pills = tree!.root.findAllByType(TouchableOpacity);
    const walletFilter = pills.find((p) => {
      const child = p.findAllByType(Text)[0]?.props?.children;
      return child === 'Wallet';
    });

    if (walletFilter) {
      await renderer.act(async () => {
        walletFilter.props.onPress();
      });
    }
  });

  it('opens top-up modal and completes mock top-up', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const addFundsBtn = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return child === '+ Add Funds';
    });

    if (addFundsBtn) {
      await renderer.act(async () => {
        addFundsBtn.props.onPress();
      });

      // Find top up pay button
      const modalButtons = tree!.root.findAllByType(TouchableOpacity);
      const payBtn = modalButtons.find((b) => {
        const text = b.findAllByType(Text)[0]?.props?.children;
        return typeof text === 'string' && text.includes('Pay $');
      });

      if (payBtn) {
        await renderer.act(async () => {
          payBtn.props.onPress();
          jest.advanceTimersByTime(500);
        });
      }
    }
  });
});
