import React from 'react';

export const KeyboardAwareScrollView: React.FC<any> = ({ children, ...props }) =>
  React.createElement('KeyboardAwareScrollView', props, children);
