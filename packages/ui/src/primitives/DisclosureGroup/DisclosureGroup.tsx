'use client';
import {
  DisclosureGroup as RACDisclosureGroup,
  type DisclosureGroupProps
} from 'react-aria-components/DisclosureGroup';
import './DisclosureGroup.module.css';

export function DisclosureGroup(props: DisclosureGroupProps) {
  return <RACDisclosureGroup {...props} />;
}
