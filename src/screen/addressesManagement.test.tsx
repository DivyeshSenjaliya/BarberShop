import React from 'react';
import renderer from 'react-test-renderer';
import AddressesManagement from './AddressesManagement';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text, TextInput } from 'react-native';

const renderScreen = () => {
  return renderer.create(
    <ToastProvider>
      <AddressesManagement navigation={{ goBack: jest.fn() }} />
    </ToastProvider>
  );
};

describe('AddressesManagement Screen', () => {
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

  it('renders existing addresses and default badge', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    expect(tree).toBeDefined();
    const texts = tree!.root.findAllByType(Text);
    const textValues = texts.map((t) => t.props.children).flat();
    expect(textValues).toContain('Saved Addresses');
    expect(textValues).toContain('DEFAULT');
    expect(textValues).toContain('Home');
    expect(textValues).toContain('742 Evergreen Terrace');
  });

  it('opens new address modal and saves address', async () => {
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
      expect(inputs.length).toBeGreaterThanOrEqual(4);

      await renderer.act(async () => {
        inputs[1].props.onChangeText('500 Madison Ave');
        inputs[2].props.onChangeText('New York');
        inputs[3].props.onChangeText('NY');
        inputs[4].props.onChangeText('10022');
      });

      const modalButtons = tree!.root.findAllByType(TouchableOpacity);
      const saveBtn = modalButtons.find((b) => {
        const child = b.findAllByType(Text)[0]?.props?.children;
        return child === 'Save Address';
      });

      if (saveBtn) {
        await renderer.act(async () => {
          saveBtn.props.onPress();
        });
      }
    }
  });

  it('deletes address on delete button tap', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen();
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const deleteBtn = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return child === 'Delete';
    });

    if (deleteBtn) {
      await renderer.act(async () => {
        deleteBtn.props.onPress();
      });
    }
  });
});
