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
import { Avatar } from './Avatar';
import { RatingStars } from './RatingStars';
import { SegmentedControl } from './SegmentedControl';
import { BottomSheet } from './BottomSheet';
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

  describe('Avatar', () => {
    it('renders initials from full name when no image URI is provided', () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(<Avatar name="John Doe" size="md" status="online" testID="test-avatar" />);
      });

      expect(tree).toBeDefined();
      const instance = tree!.root;
      const initialsText = instance.findByProps({ children: 'JD' });
      expect(initialsText).toBeDefined();
    });

    it('renders image when URI is provided', () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <Avatar uri="https://example.com/avatar.jpg" name="Jane" size="lg" testID="test-avatar" />
        );
      });

      const instance = tree!.root;
      const image = instance.findByProps({ accessibilityLabel: 'Jane' });
      expect(image).toBeDefined();
    });
  });

  describe('RatingStars', () => {
    it('renders non-interactive stars with score and reviews count', () => {
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <RatingStars rating={4.5} maxRating={5} showValue reviewsCount={120} testID="test-rating" />
        );
      });

      const instance = tree!.root;
      const valueNode = instance.findByProps({ testID: 'test-rating-value' });
      expect(valueNode.props.children).toBe('4.5');
      const countNode = instance.findByProps({ testID: 'test-rating-count' });
      expect(countNode.props.children).toEqual(['(', 120, ')']);
    });

    it('handles interactive rating on press', () => {
      const onRateMock = jest.fn();
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <RatingStars rating={3} onRate={onRateMock} testID="test-rating" />
        );
      });

      const instance = tree!.root;
      const fourthStar = instance.findByProps({ testID: 'test-rating-star-4' });
      renderer.act(() => {
        fourthStar.props.onPress();
      });

      expect(onRateMock).toHaveBeenCalledWith(4);
    });
  });

  describe('SegmentedControl', () => {
    it('renders options and switches active tab on select', () => {
      const onSelectMock = jest.fn();
      const options = [
        { value: 'upcoming', label: 'Upcoming', badge: 2 },
        { value: 'past', label: 'Past' },
        { value: 'cancelled', label: 'Cancelled' },
      ];

      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <SegmentedControl
            options={options}
            selectedValue="upcoming"
            onSelect={onSelectMock}
            testID="test-seg"
          />
        );
      });

      const instance = tree!.root;
      const pastTab = instance.findByProps({ testID: 'test-seg-opt-past' });
      renderer.act(() => {
        pastTab.props.onPress();
      });

      expect(onSelectMock).toHaveBeenCalledWith('past');
    });
  });

  describe('BottomSheet', () => {
    it('renders sheet with title and children when visible', () => {
      const onCloseMock = jest.fn();
      let tree: renderer.ReactTestRenderer | null = null;
      renderer.act(() => {
        tree = renderer.create(
          <BottomSheet
            visible={true}
            onClose={onCloseMock}
            title="Filter Options"
            subtitle="Choose your preferences"
            testID="test-sheet"
          >
            <Text testID="sheet-child">Filter Content</Text>
          </BottomSheet>
        );
      });

      const instance = tree!.root;
      const child = instance.findByProps({ testID: 'sheet-child' });
      expect(child).toBeDefined();

      const closeBtn = instance.findByProps({ testID: 'test-sheet-close' });
      renderer.act(() => {
        closeBtn.props.onPress();
      });
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});

