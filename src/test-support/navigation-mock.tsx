import React from 'react';

export const NavigationContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);

export const createNativeStackNavigator = () => {
  const Navigator: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
  const Screen: React.FC<{ name: string; component: React.ComponentType<any> }> = () => null;

  return {
    Navigator,
    Screen,
  };
};
