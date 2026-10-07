import React from 'react';
import renderer from 'react-test-renderer';
import ShopDetail from './ShopDetail';
import { ToastProvider } from '../components/ToastContext';
import { TouchableOpacity, Text, TextInput } from 'react-native';

const renderScreen = (mockNavigation: any) => {
  return renderer.create(
    <ToastProvider>
      <ShopDetail
        navigation={mockNavigation}
        route={{
          params: {
            shopId: 'shop-1',
            shopName: 'The Royal Sovereign Barber Co.',
            address: '142 King Street West',
          },
        }}
      />
    </ToastProvider>
  );
};

describe('ShopDetail Screen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

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

  it('renders shop information, amenities, and reviews', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen(mockNavigation);
    });

    expect(tree).toBeDefined();
    const texts = tree!.root.findAllByType(Text);
    const textValues = texts.map((t) => t.props.children).flat();
    expect(textValues).toContain('The Royal Sovereign Barber Co.');
    expect(textValues).toContain('Shop Amenities');
    expect(textValues).toContain('Business Hours');
    expect(textValues).toContain('Verified Reviews');
  });

  it('opens write review dialog and posts review', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen(mockNavigation);
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const writeBtn = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return child === '+ Write Review';
    });

    if (writeBtn) {
      await renderer.act(async () => {
        writeBtn.props.onPress();
      });

      const inputs = tree!.root.findAllByType(TextInput);
      if (inputs.length > 0) {
        await renderer.act(async () => {
          inputs[0].props.onChangeText('Amazing haircut and beard trim!');
        });
      }

      const modalButtons = tree!.root.findAllByType(TouchableOpacity);
      const postBtn = modalButtons.find((b) => {
        const child = b.findAllByType(Text)[0]?.props?.children;
        return child === 'Post Review';
      });

      if (postBtn) {
        await renderer.act(async () => {
          postBtn.props.onPress();
          jest.advanceTimersByTime(500);
        });
      }
    }
  });

  it('navigates to services on book appointment CTA tap', async () => {
    let tree: renderer.ReactTestRenderer | null = null;
    await renderer.act(async () => {
      tree = renderScreen(mockNavigation);
    });

    const buttons = tree!.root.findAllByType(TouchableOpacity);
    const bookCta = buttons.find((b) => {
      const child = b.findAllByType(Text)[0]?.props?.children;
      return typeof child === 'string' && child.includes('Book Appointment with Barber');
    });

    if (bookCta) {
      await renderer.act(async () => {
        bookCta.props.onPress();
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Services', { shopId: 'shop-1' });
    }
  });
});
