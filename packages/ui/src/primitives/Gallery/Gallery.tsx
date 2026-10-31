import type { CSSProperties } from 'react';
import type { MediaGalleryConfig } from '../../page-builder/block-configs';
import styles from './Gallery.module.css';

interface GalleryProps {
  config: MediaGalleryConfig;
}

type GalleryStyleProperties = CSSProperties & {
  '--gallery-gap': string;
};

export const Gallery = ({ config }: GalleryProps) => {
  const items = config.data?.items ?? [];
  const dynamicStyles: GalleryStyleProperties = {
    '--gallery-gap': config.styles?.gap ?? '1rem',
  };

  return (
    <section className={styles.section} style={dynamicStyles}>
      <div className={styles.container}>
        {config.data?.heading && <h2>{config.data.heading}</h2>}
        {items.length === 0 ? (
          <p className={styles.empty}>Add images to this gallery in the page definition.</p>
        ) : (
          <div
            className={`${styles.gallery} ${
              config.data?.layoutType === 'masonry' ? styles.masonry : ''
            }`}
          >
            {items.map((item) => (
              <figure className={styles.item} key={item.id}>
                <img src={item.src} alt={item.alt} loading="lazy" />
                {item.caption && <figcaption>{item.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
