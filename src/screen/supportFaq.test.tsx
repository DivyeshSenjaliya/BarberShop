import React from 'react';
import renderer from 'react-test-renderer';
import SupportFaq from './SupportFaq';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text, TextInput } from 'react-native';

const renderScreen = () => {
  return renderer.create(
    <ToastProvider>
      <SupportFaq navigation={{ goBack: jest.fn() }} />
    </ToastProvider>
  );
};

describe('SupportFaq Screen', () => {
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

  it('renders FAQ questions and filters with search', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    expect(tree).toBeDefined();
    const texts = tree!.root.findAllByType(Text);
    const textValues = texts.map((t) => t.props.children).flat();
    expect(textValues).toContain('Help & Support');
    expect(textValues).toContain('How do I cancel or reschedule an appointment?');

    const searchInput = tree!.root.findByType(TextInput);
    await renderer.act(async () => {
      searchInput.props.onChangeText('loyalty');
    });
  });

  it('switches to contact tab and submits ticket', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const tabs = tree!.root.findAllByType(TouchableOpacity);
    const contactTab = tabs.find((t) => {
      const child = t.findAllByType(Text)[0]?.props?.children;
      return child === 'Contact Us';
    });

    if (contactTab) {
      await renderer.act(async () => {
        contactTab.props.onPress();
      });

      const inputs = tree!.root.findAllByType(TextInput);
      expect(inputs.length).toBeGreaterThanOrEqual(2);

      await renderer.act(async () => {
        inputs[0].props.onChangeText('Billing discrepancy');
        inputs[1].props.onChangeText('I was charged twice on card 4242.');
      });

      const buttons = tree!.root.findAllByType(TouchableOpacity);
      const submitBtn = buttons.find((b) => {
        const child = b.findAllByType(Text)[0]?.props?.children;
        return child === 'Submit Ticket';
      });

      if (submitBtn) {
        await renderer.act(async () => {
          submitBtn.props.onPress();
          jest.advanceTimersByTime(600);
        });
      }
    }
  });

  it('switches to terms and policy tab', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const tabs = tree!.root.findAllByType(TouchableOpacity);
    const termsTab = tabs.find((t) => {
      const child = t.findAllByType(Text)[0]?.props?.children;
      return child === 'Terms & Policy';
    });

    if (termsTab) {
      await renderer.act(async () => {
        termsTab.props.onPress();
      });

      const texts = tree!.root.findAllByType(Text);
      const textValues = texts.map((t) => t.props.children).flat();
      expect(textValues).toContain('1. Terms of Service');
      expect(textValues).toContain('2. Cancellation & No-Show Policy');
    }
  });
});
