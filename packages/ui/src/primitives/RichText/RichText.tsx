import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
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

export const AssetBaseContext = createContext<string | undefined>(undefined);

for (const [language, grammar] of Object.entries({
  javascript,
  typescript,
  json,
  css,
  xml,
  bash,
  python,
  sql,
})) {
  hljs.registerLanguage(language, grammar);
}

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  html: 'xml',
  sh: 'bash',
  shell: 'bash',
};

const resolveAsset = (src: string, assetBasePath: string | undefined) => {
  if (!assetBasePath || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(src)) return src;
  return new URL(src, assetBasePath).toString();
};

const renderRun = (run: TextRun, key: number): ReactNode => {
  let node: ReactNode = run.text;
  if (hasMark(run, 'code')) node = <code>{node}</code>;
  if (hasMark(run, 'strike')) node = <s>{node}</s>;
  if (hasMark(run, 'underline')) node = <u>{node}</u>;
  if (hasMark(run, 'bold')) node = <strong>{node}</strong>;
  if (hasMark(run, 'italic')) node = <em>{node}</em>;
  const href = getLinkHref(run);
  if (href) node = <Link href={href}>{node}</Link>;
  return <span key={key}>{node}{run.hardBreak && <br />}</span>;
};

export const Runs = ({ runs }: { runs: TextRun[] }) => <>{runs.map(renderRun)}</>;

export const RichTextContent = ({ content }: { content: RichTextDoc }) => (
  <>
    {content.map((block) => <RichTextNode key={block.id} block={block} />)}
  </>
);

const RichTextNode = ({ block }: { block: RichTextDoc[number] }) => {
  const assetBasePath = useContext(AssetBaseContext);
  switch (block.type) {
    case 'paragraph':
      return <p style={{ textAlign: block.textAlign }}>{block.children.map(renderRun)}</p>;
    case 'heading': {
      const Heading = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4';
      return <Heading style={{ textAlign: block.textAlign }}>{block.children.map(renderRun)}</Heading>;
    }
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      const items = block.items.map((item) => (
        <li key={item.id}>
          {item.children.map(renderRun)}
          {item.blocks && <RichTextContent content={item.blocks} />}
        </li>
      ));
      return (
        block.ordered
          ? <ol key={block.id} start={block.start}>{items}</ol>
          : <List key={block.id}>{items}</List>
      );
    }
    case 'blockquote':
      return <blockquote>{block.children.map((child) => <RichTextNode key={child.id} block={child} />)}</blockquote>;
    case 'code-block':
      return <HighlightedCode text={block.text} language={block.language} />;
    case 'divider':
      return <hr />;
    case 'callout':
      return <aside className={`pb-richtext-callout pb-richtext-callout-${block.variant}`}><RichTextContent content={block.children} /></aside>;
    case 'columns':
      return (
        <div className="pb-richtext-columns">
          {block.columns.map((column) => (
            <div key={column.id} style={{ flexBasis: `${column.width ?? 100 / block.columns.length}%` }}>
              <RichTextContent content={column.children} />
            </div>
          ))}
        </div>
      );
    case 'accordion':
      return <details><summary>{block.title}</summary><RichTextContent content={block.children} /></details>;
    case 'image':
      return (
        <img
          src={resolveAsset(block.src, assetBasePath)}
          alt={block.alt}
          title={block.title}
          width={block.width}
          height={block.height}
          loading="lazy"
          style={{
            display: block.align ? 'block' : undefined,
            marginInlineStart: block.align === 'right' ? 'auto' : block.align === 'center' ? 'auto' : undefined,
            marginInlineEnd: block.align === 'left' ? 'auto' : block.align === 'center' ? 'auto' : undefined,
          }}
        />
      );
    case 'audio':
      return <figure><figcaption>{block.title ?? 'Audio'}</figcaption><audio controls preload="metadata" src={resolveAsset(block.src, assetBasePath)} /></figure>;
    case 'video':
      return <figure><figcaption>{block.title ?? 'Video'}</figcaption><video controls preload="metadata" src={resolveAsset(block.src, assetBasePath)} poster={block.poster ? resolveAsset(block.poster, assetBasePath) : undefined} width={block.width} height={block.height} /></figure>;
    case 'youtube':
      return <iframe title={block.title ?? 'YouTube video'} src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(block.videoId)}`} width={block.width ?? 640} height={block.height ?? 360} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />;
    case 'vimeo': {
      const videoId = block.src.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1];
      return videoId
        ? <iframe title={block.title ?? 'Vimeo video'} src={`https://player.vimeo.com/video/${videoId}`} width={block.width ?? 640} height={block.height ?? 360} loading="lazy" allow="autoplay; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        : <p role="alert">Invalid Vimeo URL.</p>;
    }
    case 'iframe':
      return <iframe title={block.title?.trim() || 'Embedded content'} src={resolveAsset(block.src, assetBasePath)} width={block.width ?? '100%'} height={block.height ?? '400'} loading="lazy" sandbox="allow-scripts allow-presentation" referrerPolicy="strict-origin-when-cross-origin" />;
  }
};

const HighlightedCode = ({ text, language }: { text: string; language?: string }) => {
  const requested = language?.toLowerCase() ?? '';
  const normalized = LANGUAGE_ALIASES[requested] ?? requested;
  const safeLanguage = /^[a-z0-9_-]{1,40}$/i.test(requested) ? requested : '';
  const highlightLanguage = hljs.getLanguage(normalized) ? normalized : undefined;
  const highlighted = highlightLanguage
    ? hljs.highlight(text, { language: highlightLanguage, ignoreIllegals: true }).value
    : undefined;
  return (
    <pre>
      <code
        className={safeLanguage ? `hljs language-${safeLanguage}` : undefined}
        {...(highlighted === undefined ? {} : { dangerouslySetInnerHTML: { __html: highlighted } })}
      >
        {highlighted === undefined ? text : undefined}
      </code>
    </pre>
  );
};

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
