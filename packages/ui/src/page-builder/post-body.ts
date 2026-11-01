import {
  createHeading,
  createParagraph,
  richTextToPlainText,
  type RichTextDoc,
} from './rich-text';

/**
 * Post body model: article metadata plus structured rich-text content.
 * Stored as the `data` of a `post-body` block.
 */
export interface PostBodyData {
  title: string;
  author?: string;
  /** ISO date (YYYY-MM-DD). */
  publishedOn?: string;
  content: RichTextDoc;
}

export const createPostBodyData = (): PostBodyData => ({
  title: 'Untitled post',
  author: '',
  publishedOn: '',
  content: [createHeading('Introduction'), createParagraph('')],
});

const WORDS_PER_MINUTE = 200;

export const countWords = (data: Pick<PostBodyData, 'content'>) => {
  const text = richTextToPlainText(data.content).trim();
  return text === '' ? 0 : text.split(/\s+/).length;
};

export const readingTimeMinutes = (data: Pick<PostBodyData, 'content'>) =>
  Math.max(1, Math.ceil(countWords(data) / WORDS_PER_MINUTE));

/** First non-empty paragraph, trimmed to a length suitable for an excerpt. */
export const postExcerpt = (data: Pick<PostBodyData, 'content'>, max = 160) => {
  const first = data.content.find(
    (block) => block.type === 'paragraph' && richTextToPlainText([block]).trim() !== '',
  );
  const text = first ? richTextToPlainText([first]).trim() : '';
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
};
