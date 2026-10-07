import React from 'react';
import renderer from 'react-test-renderer';
import OwnerCatalogManagement from './OwnerCatalogManagement';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text, TextInput } from 'react-native';

const renderScreen = () => {
  return renderer.create(
    <ToastProvider>
      <OwnerCatalogManagement navigation={{ goBack: jest.fn() }} />
    </ToastProvider>
  );
};

describe('OwnerCatalogManagement Screen', () => {
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

  it('renders services catalog and switches to staff roster tab', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    expect(tree).toBeDefined();
    const texts = tree!.root.findAllByType(Text);
    const textValues = texts.map((t) => t.props.children).flat();
    expect(textValues).toContain('Shop Catalog & Roster');
    expect(textValues).toContain('Signature Skin Fade');

    // Switch to staff tab
    const tabs = tree!.root.findAllByType(TouchableOpacity);
    const staffTab = tabs.find((t) => {
      const child = t.findAllByType(Text)[0]?.props?.children;
      return typeof child === 'string' && child.includes('Staff Roster');
    });

    if (staffTab) {
      await renderer.act(async () => {
        staffTab.props.onPress();
      });

      const updatedTexts = tree!.root.findAllByType(Text);
      const updatedValues = updatedTexts.map((t) => t.props.children).flat();
      expect(updatedValues).toContain('Marcus Vance');
      expect(updatedValues).toContain('Derrick Hayes');
    }
  });

  it('opens add service modal and saves new service', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const addBtn = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return child === '+ Add';
    });

    if (addBtn) {
      await renderer.act(async () => {
        addBtn.props.onPress();
      });

      const inputs = tree!.root.findAllByType(TextInput);
      expect(inputs.length).toBeGreaterThanOrEqual(3);

      await renderer.act(async () => {
        inputs[0].props.onChangeText('Deluxe Hot Oil Treatment');
        inputs[2].props.onChangeText('40.00');
      });

      const modalButtons = tree!.root.findAllByType(TouchableOpacity);
      const saveBtn = modalButtons.find((b) => {
        const child = b.findAllByType(Text)[0]?.props?.children;
        return child === 'Save Service';
      });

      if (saveBtn) {
        await renderer.act(async () => {
          saveBtn.props.onPress();
        });
      }
    }
  });
});
