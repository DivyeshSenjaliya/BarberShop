import React from 'react';

export const Platform = {
  OS: 'ios' as const,
  select: <T>(obj: { ios?: T; android?: T; default?: T }): T => obj.ios ?? (obj.default as T),
};

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => (Array.isArray(style) ? Object.assign({}, ...style) : style || {}),
};

export const Dimensions = {
  get: (_dim: string) => ({ width: 375, height: 812 }),
};

export const Alert = {
  alert: jest.fn(),
};

const createMockComponent = (name: string) => {
  const Component: React.FC<any> = ({ children, ...props }) =>
    React.createElement(name, props, children);
  Component.displayName = name;
  return Component;
};

export const View = createMockComponent('View');
export const Text = createMockComponent('Text');
export const TouchableOpacity = createMockComponent('TouchableOpacity');
export const TextInput = createMockComponent('TextInput');
export const ActivityIndicator = createMockComponent('ActivityIndicator');
export const Modal = createMockComponent('Modal');
export const SafeAreaView = createMockComponent('SafeAreaView');
export const ScrollView = createMockComponent('ScrollView');
export const Image = createMockComponent('Image');
export const ImageBackground = createMockComponent('ImageBackground');

export type ViewStyle = Record<string, unknown>;
export type TextStyle = Record<string, unknown>;
export type ImageStyle = Record<string, unknown>;
export type TextInputProps = Record<string, unknown>;
