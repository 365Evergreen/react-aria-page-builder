'use client';
import {ColorArea as AriaColorArea, type ColorAreaProps} from 'react-aria-components/ColorArea';
import {ColorThumb} from '../ColorThumb/ColorThumb';
import './ColorArea.module.css';

export function ColorArea(props: ColorAreaProps) {
  return (
    <AriaColorArea {...props}>
      <ColorThumb />
    </AriaColorArea>
  );
}
