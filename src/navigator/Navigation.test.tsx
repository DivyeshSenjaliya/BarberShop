import React from 'react';
import renderer from 'react-test-renderer';
import Navigation from './Navigation';
import { AuthProvider } from '../context/AuthContext';
import { BookingProvider } from '../context/BookingContext';
import { ToastProvider } from '../components/ToastContext';

describe('Root Navigation', () => {
  it('renders application navigation container and routes', () => {
    let tree: renderer.ReactTestRenderer | null = null;
    renderer.act(() => {
      tree = renderer.create(
        <AuthProvider>
          <BookingProvider>
            <ToastProvider>
              <Navigation />
            </ToastProvider>
          </BookingProvider>
        </AuthProvider>
      );
    });

    expect(tree).toBeDefined();
  });
});
