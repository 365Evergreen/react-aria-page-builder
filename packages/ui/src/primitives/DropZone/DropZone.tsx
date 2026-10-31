'use client';
import {type DropZoneProps, DropZone as RACDropZone, Text} from 'react-aria-components/DropZone';
import './DropZone.module.css';

export function DropZone(props: DropZoneProps) {
  return <RACDropZone {...props} />;
}

export {Text};
