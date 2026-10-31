'use client';
import {
  Dialog as RACDialog,
  DialogTrigger as RACDialogTrigger,
  Heading,
  type DialogProps,
  type DialogTriggerProps
} from 'react-aria-components/Dialog';
import './Dialog.module.css';

export function Dialog(props: DialogProps) {
  return <RACDialog {...props} />;
}

export function DialogTrigger(props: DialogTriggerProps) {
  return <RACDialogTrigger {...props} />;
}

export {Heading};
