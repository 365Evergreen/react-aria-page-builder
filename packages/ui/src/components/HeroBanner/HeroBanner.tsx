import type { CSSProperties } from 'react';
import type { HeroBannerConfig } from '../../page-builder/block-configs';
import styles from './HeroBanner.module.css';

interface HeroBannerProps {
  config: HeroBannerConfig;
}

type HeroStyleProperties = CSSProperties & {
  '--hero-height': string;
  '--hero-text-align': CSSProperties['textAlign'];
  '--hero-content-position': CSSProperties['justifyContent'];
};

const alignmentToPosition = (
  alignment: 'left' | 'center' | 'right' | undefined,
): CSSProperties['justifyContent'] => {
  if (alignment === 'left') return 'flex-start';
  if (alignment === 'right') return 'flex-end';
  return 'center';
};

export const HeroBanner = ({ config }: HeroBannerProps) => {
  const data = config.data;
  const textAlign = config.styles?.textAlign ?? 'center';
  const hasImage = Boolean(data?.bgImage);

  const dynamicStyles: HeroStyleProperties = {
    '--hero-height': config.styles?.height ?? '50vh',
    '--hero-text-align': textAlign,
    '--hero-content-position': alignmentToPosition(textAlign),
    backgroundImage: hasImage ? `url(${JSON.stringify(data?.bgImage)})` : undefined,
  };

  return (
    <section
      className={styles.hero}
      style={dynamicStyles}
      aria-label={data?.title ?? 'Hero banner'}
    >
      <div className={styles.overlay}>
        <div className={styles.content}>
          {data?.eyebrow && <p className={styles.eyebrow}>{data.eyebrow}</p>}
          <h1 className={styles.title}>{data?.title ?? 'Placeholder heading'}</h1>
          {data?.description && (
            <p className={styles.description}>{data.description}</p>
          )}
          {data?.buttonText && data.buttonUrl && (
            <a className={styles.ctaButton} href={data.buttonUrl}>
              {data.buttonText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
};
