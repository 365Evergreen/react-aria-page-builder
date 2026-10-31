import {ColorThumb as AriaColorThumb, type ColorThumbProps} from 'react-aria-components/ColorThumb';
import './ColorThumb.module.css';

export function ColorThumb(props: ColorThumbProps) {
  return <AriaColorThumb {...props} />;
}
