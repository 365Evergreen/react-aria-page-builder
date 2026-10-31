'use client';
import {
  DateRangePicker as AriaDateRangePicker,
  type DateRangePickerProps as AriaDateRangePickerProps,
  type DateValue,
  Group,
  type ValidationResult
} from 'react-aria-components/DateRangePicker';
import {DateInput, DateSegment} from '../DateField/DateField';
import {Description, FieldButton} from '../Form/Form';
import {Popover} from '../Popover/Popover';
import {Label, FieldError} from '../Form/Form';
import {RangeCalendar} from '../RangeCalendar/RangeCalendar';
import {ChevronDown} from 'lucide-react';
import './DateRangePicker.module.css';

export interface DateRangePickerProps<T extends DateValue> extends AriaDateRangePickerProps<T> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export function DateRangePicker<T extends DateValue>({
  label,
  description,
  errorMessage,
  ...props
}: DateRangePickerProps<T>) {
  return (
    <AriaDateRangePicker {...props}>
      <Label>{label}</Label>
      <Group className="react-aria-Group inset">
        <div className="date-fields">
          <DateInput slot="start">{segment => <DateSegment segment={segment} />}</DateInput>
          <span aria-hidden="true">–</span>
          <DateInput slot="end">{segment => <DateSegment segment={segment} />}</DateInput>
        </div>
        <FieldButton>
          <ChevronDown />
        </FieldButton>
      </Group>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
      <Popover hideArrow>
        <RangeCalendar />
      </Popover>
    </AriaDateRangePicker>
  );
}
