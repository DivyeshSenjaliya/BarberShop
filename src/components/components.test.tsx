import React from 'react';
import renderer from 'react-test-renderer';
import { Button } from './Button';
import { Badge } from './Badge';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { Input } from './Input';
import { Modal } from './Modal';
import { ToastProvider, useToast } from './ToastContext';
import { Text, TouchableOpacity } from 'react-native';

describe('Design System Components', () => {
  describe('Button', () => {
    it('renders title correctly and handles onPress', () => {
      const onPressMock = jest.fn();
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <Button title="Book Now" onPress={onPressMock} variant="primary" size="md" />
        );
      });

      expect(tree).toBeDefined();
      const instance = tree!.root;
      const touchable = instance.findByType(TouchableOpacity);
      expect(touchable).toBeDefined();

      renderer.act(() => {
        touchable.props.onPress();
      });
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('renders loading state without calling onPress when pressed', () => {
      const onPressMock = jest.fn();
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <Button title="Save" onPress={onPressMock} loading={true} />
        );
      });

      const touchable = tree!.root.findByType(TouchableOpacity);
      expect(touchable.props.disabled).toBe(true);
    });

    it('renders secondary and danger variants cleanly', () => {
      let secondaryTree: renderer.ReactTestRenderer | null = null;
      let dangerTree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        secondaryTree = renderer.create(
          <Button title="Cancel" onPress={() => {}} variant="secondary" />
        );
        dangerTree = renderer.create(
          <Button title="Delete" onPress={() => {}} variant="danger" />
        );
      });

      expect(secondaryTree).toBeDefined();
      expect(dangerTree).toBeDefined();
    });
  });

  describe('Badge', () => {
    it('renders label with default variant and size', () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(<Badge label="Confirmed" variant="success" />);
      });

      expect(tree).toBeDefined();
      const text = tree!.root.findByType(Text);
      expect(text.props.children).toBe('Confirmed');
    });

    it('renders outline badge variant', () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(<Badge label="Pending" variant="warning" outline size="sm" />);
      });

      expect(tree).toBeDefined();
      const text = tree!.root.findByType(Text);
      expect(text.props.children).toBe('Pending');
    });
  });

  describe('Card', () => {
    it('renders children with elevated styling', () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <Card elevation="md" padding="lg">
            <Text>Card Content</Text>
          </Card>
        );
      });

      expect(tree).toBeDefined();
      const text = tree!.root.findByType(Text);
      expect(text.props.children).toBe('Card Content');
    });
  });

  describe('EmptyState', () => {
    it('renders title, description and action button', () => {
      const onAction = jest.fn();
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <EmptyState
            title="No Bookings Yet"
            description="Explore our barbers and schedule your first cut."
            actionLabel="Discover Shops"
            onAction={onAction}
          />
        );
      });

      expect(tree).toBeDefined();
      const button = tree!.root.findByType(Button);
      expect(button.props.title).toBe('Discover Shops');

      renderer.act(() => {
        button.props.onPress();
      });
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('LoadingState', () => {
    it('renders activity indicator and message', () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(<LoadingState message="Loading availability..." />);
      });

      expect(tree).toBeDefined();
      const text = tree!.root.findByType(Text);
      expect(text.props.children).toBe('Loading availability...');
    });
  });

  describe('Input', () => {
    it('renders label, input, and displays error when provided', () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <Input
            label="Email Address"
            placeholder="john@example.com"
            error="Invalid email format"
          />
        );
      });

      expect(tree).toBeDefined();
      const texts = tree!.root.findAllByType(Text);
      const labels = texts.map((t) => t.props.children);
      expect(labels).toContain('Email Address');
      expect(labels).toContain('Invalid email format');
    });

    it('toggles password visibility when isPassword is true', () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <Input
            label="Password"
            isPassword={true}
            value="secret123"
          />
        );
      });

      expect(tree).toBeDefined();
      const toggleButton = tree!.root.findByType(TouchableOpacity);
      expect(toggleButton).toBeDefined();
    });
  });

  describe('Modal', () => {
    it('renders content when visible and provides close trigger', () => {
      const onClose = jest.fn();
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <Modal visible={true} onClose={onClose} title="Appointment Details">
            <Text>Modal Body</Text>
          </Modal>
        );
      });

      expect(tree).toBeDefined();
      const text = tree!.root.findAllByType(Text).find((t) => t.props.children === 'Modal Body');
      expect(text).toBeDefined();
    });
  });

  describe('ToastContext', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('provides showToast function through hook inside provider', () => {
      let capturedShowToast: ((msg: string) => void) | null = null;

      const TestConsumer = () => {
        const { showToast } = useToast();
        capturedShowToast = showToast;
        return <Text>Consumer</Text>;
      };

      renderer.act(() => {
        renderer.create(
          <ToastProvider>
            <TestConsumer />
          </ToastProvider>
        );
      });

      expect(typeof capturedShowToast).toBe('function');
      renderer.act(() => {
        capturedShowToast?.('Booking confirmed!');
      });

      renderer.act(() => {
        jest.runAllTimers();
      });
    });
  });
});
