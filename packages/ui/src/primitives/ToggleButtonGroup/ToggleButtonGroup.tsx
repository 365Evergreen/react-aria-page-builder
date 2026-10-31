'use client';
import {
  ToggleButtonGroup as RACToggleButtonGroup,
  type ToggleButtonGroupProps
} from 'react-aria-components/ToggleButtonGroup';
import './ToggleButtonGroup.module.css';

export function ToggleButtonGroup(props: ToggleButtonGroupProps) {
  return <RACToggleButtonGroup {...props} />;
}
