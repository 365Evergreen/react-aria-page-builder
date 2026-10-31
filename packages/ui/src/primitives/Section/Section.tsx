import type { CSSProperties } from 'react';
import type { GridSectionConfig } from '../../page-builder/block-configs';
import styles from './Section.module.css';

interface SectionProps {
  config: GridSectionConfig;
}

type SectionStyleProperties = CSSProperties & {
  '--section-padding': string;
  '--section-gap': string;
  '--section-columns': number;
};

export const Section = ({ config }: SectionProps) => {
  const dynamicStyles: SectionStyleProperties = {
    '--section-padding': config.styles?.padding ?? '4rem 1.5rem',
    '--section-gap': config.styles?.gap ?? '1.5rem',
    '--section-columns': config.data?.columns ?? 1,
  };

  return (
    <section
      id={config.id}
      className={styles.section}
      style={dynamicStyles}
    >
      <div className={styles.container}>
        {config.data?.heading && (
          <h2 className={styles.heading}>{config.data.heading}</h2>
        )}
        <div className={styles.grid}>
          {(config.data?.items ?? []).map((item) => (
            <article className={styles.card} key={item.id}>
              <h3>{item.title}</h3>
              {item.description && <p>{item.description}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
