'use client';
import {Link as RACLink, type LinkProps} from 'react-aria-components/Link';
import './Link.module.css';

export function Link(props: LinkProps) {
  return <RACLink {...props} />;
}
