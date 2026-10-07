import React from 'react';

export const Calendar: React.FC<any> = ({ children, ...props }) =>
  React.createElement('Calendar', props, children);

export const LocaleConfig = {
  locales: {},
  defaultLocale: 'en',
};
