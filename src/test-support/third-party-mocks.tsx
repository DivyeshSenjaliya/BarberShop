import React from 'react';

export const Screen: React.FC<any> = ({ children, ...props }) =>
  React.createElement('Screen', props, children);

export const Rating: React.FC<any> = (props) =>
  React.createElement('Rating', props);

export const CheckBox: React.FC<any> = (props) =>
  React.createElement('CheckBox', props);

const BottomDrawer: React.FC<any> = ({ children, ...props }) =>
  React.createElement('BottomDrawer', props, children);
export default BottomDrawer;
