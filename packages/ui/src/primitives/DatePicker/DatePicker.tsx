'use client';
import {
  DatePicker as AriaDatePicker,
  type DatePickerProps as AriaDatePickerProps,
  type DateValue,
  Group,
  type ValidationResult
} from 'react-aria-components/DatePicker';
import {DateInput, DateSegment} from '../DateField/DateField';
import {Label, FieldError, Description} from '../Form/Form';
import {FieldButton} from '../Form/Form';
import {Calendar} from '../Calendar/Calendar';
import {Popover} from '../Popover/Popover';
import {ChevronDown} from 'lucide-react';
import './DatePicker.module.css';

export interface DatePickerProps<T extends DateValue> extends AriaDatePickerProps<T> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export function DatePicker<T extends DateValue>({
  label,
  description,
  errorMessage,
  ...props
}: DatePickerProps<T>) {
  return (
    <AriaDatePicker {...props}>
      <Label>{label}</Label>
      <Group>
        <DateInput>{segment => <DateSegment segment={segment} />}</DateInput>
        <FieldButton>
          <ChevronDown />
        </FieldButton>
      </Group>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover hideArrow>
        <Calendar />
      </Popover>
    </AriaDatePicker>
  );
}
