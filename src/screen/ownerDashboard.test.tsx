import React from 'react';
import renderer from 'react-test-renderer';
import OwnerDashboard from './OwnerDashboard';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text } from 'react-native';

const renderScreen = () => {
  return renderer.create(
    <ToastProvider>
      <OwnerDashboard navigation={{ goBack: jest.fn() }} />
    </ToastProvider>
  );
};

describe('OwnerDashboard Screen', () => {
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

  it('renders revenue KPIs, leaderboard, and popular services', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    expect(tree).toBeDefined();
    const texts = tree!.root.findAllByType(Text);
    const textValues = texts.map((t) => t.props.children).flat();
    expect(textValues).toContain('Shop Owner Analytics');
    expect(textValues).toContain('Gross Sales');
    expect(textValues).toContain('Net Shop Income');
    expect(textValues).toContain('Staff Leaderboard');
    expect(textValues).toContain('Marcus Vance');
    expect(textValues).toContain('Top Requested Services');
  });

  it('switches date range filters', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const pills = tree!.root.findAllByType(TouchableOpacity);
    const monthPill = pills.find((p) => {
      const child = p.findAllByType(Text)[0]?.props?.children;
      return child === 'This Month';
    });

    if (monthPill) {
      await renderer.act(async () => {
        monthPill.props.onPress();
      });
    }
  });

  it('triggers PDF export on PDF button tap', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const pdfBtn = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return child === 'PDF';
    });

    if (pdfBtn) {
      await renderer.act(async () => {
        pdfBtn.props.onPress();
      });
    }
  });
});
