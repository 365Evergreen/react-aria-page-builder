import type { CSSProperties, ReactNode } from 'react';
import type {
  PostBodyConfig,
  RichTextBlockConfig,
} from '../../page-builder/block-configs';
import {
  getLinkHref,
  hasMark,
  type RichTextDoc,
  type TextRun,
} from '../../page-builder/rich-text';
import { Link } from '../Link/Link';
import styles from './RichText.module.css';

const renderRun = (run: TextRun, key: number): ReactNode => {
  let node: ReactNode = run.text;
  if (hasMark(run, 'code')) node = <code>{node}</code>;
  if (hasMark(run, 'bold')) node = <strong>{node}</strong>;
  if (hasMark(run, 'italic')) node = <em>{node}</em>;
  const href = getLinkHref(run);
  if (href) node = <Link href={href}>{node}</Link>;
  return <span key={key}>{node}</span>;
};

export const Runs = ({ runs }: { runs: TextRun[] }) => <>{runs.map(renderRun)}</>;

export const RichTextContent = ({ content }: { content: RichTextDoc }) => (
  <>
    {content.map((block) => {
      if (block.type === 'paragraph') {
        return block.children.length === 0 ? null : (
          <p key={block.id}>
            <Runs runs={block.children} />
          </p>
        );
      }
      if (block.type === 'heading') {
        const Heading = `h${block.level}` as 'h2' | 'h3' | 'h4';
        return (
          <Heading key={block.id}>
            <Runs runs={block.children} />
          </Heading>
        );
      }
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List key={block.id}>
          {block.items.map((item) => (
            <li key={item.id}>
              <Runs runs={item.children} />
            </li>
          ))}
        </List>
      );
    })}
  </>
);

const widthStyle = (maxWidth: string | undefined) =>
  ({ '--text-max-width': maxWidth ?? '44rem' }) as CSSProperties;

interface RichTextProps {
  config: RichTextBlockConfig;
}

export const RichText = ({ config }: RichTextProps) => (
  <section id={config.id} className={styles.section} style={widthStyle(config.styles?.maxWidth)}>
    <div className={styles.body}>
      <RichTextContent content={config.data?.content ?? []} />
    </div>
  </section>
);

interface PostBodyProps {
  config: PostBodyConfig;
  headingLevel?: 1 | 2;
}

export const PostBody = ({ config, headingLevel = 2 }: PostBodyProps) => {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const data = config.data;
  return (
    <article id={config.id} className={styles.section} style={widthStyle(config.styles?.maxWidth)}>
      <div className={styles.body}>
        <header className={styles.postHeader}>
          <Heading className={styles.postTitle}>{data?.title}</Heading>
          {(data?.author || data?.publishedOn) && (
            <p className={styles.byline}>
              {data.author && <span>By {data.author}</span>}
              {data.author && data.publishedOn && ' · '}
              {data.publishedOn && <time dateTime={data.publishedOn}>{data.publishedOn}</time>}
            </p>
          )}
        </header>
        <RichTextContent content={data?.content ?? []} />
      </div>
    </article>
  );
};
