import React from 'react';
import renderer from 'react-test-renderer';
import Login from './Login';
import SingUp from './SingUp';
import Forgot from './Forgot';
import Reset from './Reset';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../components/ToastContext';
import { TextInput, TouchableOpacity } from 'react-native';

const renderWithProviders = (component: React.ReactElement) => {
  return renderer.create(
    <AuthProvider>
      <ToastProvider>{component}</ToastProvider>
    </AuthProvider>
  );
};

describe('Mobile Auth Screens', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    renderer.act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  describe('Login Screen', () => {
    it('renders login screen inputs and buttons', () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderWithProviders(<Login navigation={mockNavigation as any} />);
      });

      expect(tree).toBeDefined();
      const inputs = tree!.root.findAllByType(TextInput);
      expect(inputs.length).toBeGreaterThanOrEqual(2); // email and password
    });

    it('triggers validation when submitting with empty fields', async () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderWithProviders(<Login navigation={mockNavigation as any} />);
      });

      const buttons = tree!.root.findAllByType(TouchableOpacity);
      // Find login submit button
      const loginButton = buttons.find((b) =>
        b.props.style?.some?.((s: any) => s && s.backgroundColor)
      );

      if (loginButton) {
        await renderer.act(async () => {
          loginButton.props.onPress();
        });
      }
      // Should not navigate on validation error
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });
  });

  describe('SingUp Screen', () => {
    it('renders registration form with role selector', () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderWithProviders(<SingUp navigation={mockNavigation as any} />);
      });

      expect(tree).toBeDefined();
      const inputs = tree!.root.findAllByType(TextInput);
      expect(inputs.length).toBeGreaterThanOrEqual(5); // firstName, lastName, email, phone, password, confirmPassword
    });
  });

  describe('Forgot Screen', () => {
    it('validates email before dispatching reset instructions', async () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderWithProviders(<Forgot navigation={mockNavigation as any} />);
      });

      const input = tree!.root.findByType(TextInput);
      renderer.act(() => {
        input.props.onChangeText('alex@example.com');
      });

      const buttons = tree!.root.findAllByType(TouchableOpacity);
      const submitBtn = buttons[buttons.length - 1];

      await renderer.act(async () => {
        submitBtn.props.onPress();
        jest.advanceTimersByTime(4000);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Reset');
    });
  });

  describe('Reset Screen', () => {
    it('validates matching passwords before submitting', async () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderWithProviders(<Reset navigation={mockNavigation as any} />);
      });

      const inputs = tree!.root.findAllByType(TextInput);
      renderer.act(() => {
        inputs[0].props.onChangeText('StrongP@ssw0rd!');
        inputs[1].props.onChangeText('StrongP@ssw0rd!');
      });

      const buttons = tree!.root.findAllByType(TouchableOpacity);
      const submitBtn = buttons[buttons.length - 1];

      await renderer.act(async () => {
        submitBtn.props.onPress();
        jest.advanceTimersByTime(4000);
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Login');
    });
  });
});
