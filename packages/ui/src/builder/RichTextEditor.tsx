import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { Button } from '../primitives/Button/Button';
import { TextField } from '../primitives/TextField/TextField';
import { ToggleButton } from '../primitives/ToggleButton/ToggleButton';
import { ToggleButtonGroup } from '../primitives/ToggleButtonGroup/ToggleButtonGroup';
import { SAFE_LINK } from '../page-builder/safe-url';
import {
  MAX_RUN_TEXT,
  createHeading,
  createList,
  createParagraph,
  createRichTextBlock,
  createRun,
  getLinkHref,
  hasMark,
  setLink,
  toggleMark,
  type HeadingLevel,
  type RichTextBlock,
  type RichTextDoc,
  type TextAlignment,
  type TextRun,
} from '../page-builder/rich-text';

type SimpleMark = 'bold' | 'italic' | 'underline' | 'strike' | 'code';
const MARKS: { key: SimpleMark; label: string }[] = [
  { key: 'bold', label: 'Bold' },
  { key: 'italic', label: 'Italic' },
  { key: 'underline', label: 'Underline' },
  { key: 'strike', label: 'Strikethrough' },
  { key: 'code', label: 'Code' },
];
const URL_PATTERN = /https?:\/\/[^\s<>]+|www\.[^\s<>]+/gi;
const TRAILING_URL_PUNCTUATION = /[.,;:!?)}\]]+$/;

const autoLinkRuns = (runs: TextRun[]): TextRun[] =>
  runs.flatMap((run) => {
    if (getLinkHref(run)) return [run];
    const result: TextRun[] = [];
    let cursor = 0;
    for (const match of run.text.matchAll(new RegExp(URL_PATTERN.source, 'gi'))) {
      const start = match.index ?? 0;
      const matched = match[0];
      const punctuation = matched.match(TRAILING_URL_PUNCTUATION)?.[0] ?? '';
      const linkText = punctuation ? matched.slice(0, -punctuation.length) : matched;
      const href = linkText.startsWith('www.') ? `https://${linkText}` : linkText;
      if (!linkText || !SAFE_LINK.test(href)) continue;
      if (start > cursor) result.push({ text: run.text.slice(cursor, start), marks: run.marks });
      result.push({ text: linkText, marks: [...(run.marks ?? []), { type: 'link', href }] });
      if (punctuation) result.push({ text: punctuation, marks: run.marks });
      cursor = start + matched.length;
    }
    if (cursor === 0) return [run];
    if (cursor < run.text.length) result.push({ text: run.text.slice(cursor), marks: run.marks });
    return result;
  });

const BLOCK_KINDS = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'heading-1', label: 'Heading level 1' },
  { value: 'heading-2', label: 'Heading level 2' },
  { value: 'heading-3', label: 'Heading level 3' },
  { value: 'heading-4', label: 'Heading level 4' },
  { value: 'list-bullet', label: 'Bulleted list' },
  { value: 'list-number', label: 'Numbered list' },
];

const kindOf = (block: Extract<RichTextBlock, { type: 'paragraph' | 'heading' | 'list' }>) =>
  block.type === 'heading'
    ? `heading-${block.level}`
    : block.type === 'list'
      ? block.ordered
        ? 'list-number'
        : 'list-bullet'
      : 'paragraph';

const blockSummary = (block: RichTextBlock) => {
  if (block.type !== 'paragraph' && block.type !== 'heading' && block.type !== 'list') {
    return block.type.replace('-', ' ');
  }
  return BLOCK_KINDS.find((kind) => kind.value === kindOf(block))?.label ?? 'Block';
};

const runsOf = (
  block: Extract<RichTextBlock, { type: 'paragraph' | 'heading' | 'list' }>,
): TextRun[] => block.type === 'list' ? (block.items[0]?.children ?? [createRun()]) : block.children;

/** Converts a block to another kind, keeping its text. */
export const convertRichTextBlock = (
  block: Extract<RichTextBlock, { type: 'paragraph' | 'heading' | 'list' }>,
  kind: string,
): RichTextBlock[] => {
  const runs = runsOf(block);
  if (kind === 'paragraph') {
    if (block.type === 'list') {
      return block.items.flatMap((item, index) => [
        { id: index === 0 ? block.id : item.id, type: 'paragraph' as const, children: item.children },
        ...(item.blocks ?? []),
      ]);
    }
    return [{ id: block.id, type: 'paragraph', children: runs }];
  }
  if (kind.startsWith('heading-')) {
    const level = Number(kind.slice(-1)) as HeadingLevel;
    if (block.type === 'list') {
      return block.items.flatMap((item, index) => [
        {
          id: index === 0 ? block.id : item.id,
          type: 'heading' as const,
          level,
          children: item.children,
        },
        ...(item.blocks ?? []),
      ]);
    }
    return [{ id: block.id, type: 'heading', level, children: runs }];
  }
  const ordered = kind === 'list-number';
  if (block.type === 'list') return [{ ...block, ordered }];
  return [{ id: block.id, type: 'list', ordered, items: [{ id: crypto.randomUUID(), children: runs }] }];
};

function LinkInput({ run, label, onChange }: { run: TextRun; label: string; onChange: (run: TextRun) => void }) {
  const href = getLinkHref(run);
  const [draft, setDraft] = useState(href);
  const error =
    draft.trim() !== '' && !SAFE_LINK.test(draft.trim())
      ? 'Use an http(s), mailto or tel URL, or a relative or # link.'
      : null;

  useEffect(() => {
    setDraft((current) => (current !== href && error === null ? href : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);

  return (
    <TextField
      label={`${label} link URL`}
      value={draft}
      type="url"
      validationBehavior="aria"
      isInvalid={error !== null}
      errorMessage={error ?? undefined}
      onChange={(next) => {
        setDraft(next);
        if (next.trim() === '' || SAFE_LINK.test(next.trim())) onChange(setLink(run, next.trim()));
      }}
    />
  );
}

interface RunsEditorProps {
  label: string;
  runs: TextRun[];
  onChange: (runs: TextRun[]) => void;
}

function RunsEditor({ label, runs, onChange }: RunsEditorProps) {
  const setRun = (index: number, next: TextRun) =>
    onChange(runs.map((run, at) => (at === index ? next : run)));

  return (
    <fieldset className="pb-richtext-runs">
      <legend>{label}</legend>
      {runs.map((run, index) => {
        const name = `${label}, part ${index + 1}`;
        const selected = MARKS.filter((mark) => hasMark(run, mark.key)).map((mark) => mark.key);
        return (
          <div className="pb-richtext-run" key={index}>
            <TextField
              label={`${name} text`}
              value={run.text}
              maxLength={MAX_RUN_TEXT}
              onChange={(text) => setRun(index, { ...run, text })}
              onBlur={() => {
                const linked = autoLinkRuns(runs);
                if (linked.some((part, at) => part !== runs[at])) onChange(linked);
              }}
            />
            <ToggleButtonGroup
              aria-label={`${name} formatting`}
              selectionMode="multiple"
              selectedKeys={selected}
              onSelectionChange={(keys) => {
                let next = run;
                for (const mark of MARKS) {
                  const on = keys.has(mark.key);
                  if (on !== hasMark(next, mark.key)) next = toggleMark(next, mark.key, on);
                }
                setRun(index, next);
              }}
            >
              {MARKS.map((mark) => (
                <ToggleButton key={mark.key} id={mark.key} variant="secondary">
                  {mark.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button
              variant="quiet"
              aria-pressed={run.hardBreak === true}
              onPress={() => setRun(index, { ...run, hardBreak: !run.hardBreak || undefined })}
            >
              {run.hardBreak ? `Remove line break after ${name}` : `Insert line break after ${name}`}
            </Button>
            <LinkInput run={run} label={name} onChange={(next) => setRun(index, next)} />
            {runs.length > 1 && (
              <Button
                variant="quiet"
                onPress={() => onChange(runs.filter((_, at) => at !== index))}
              >
                Remove {name}
              </Button>
            )}
          </div>
        );
      })}
      <Button variant="quiet" onPress={() => onChange([...runs, createRun()])}>
        Add text part to {label}
      </Button>
    </fieldset>
  );
}

interface RichTextEditorProps {
  label: string;
  value: RichTextDoc;
  onChange: (doc: RichTextDoc) => void;
  uploadMedia?: (file: File) => Promise<string>;
}

export function RichTextEditor({ label, value, onChange, uploadMedia }: RichTextEditorProps) {
  const setBlock = (index: number, block: RichTextBlock) =>
    onChange(value.map((current, at) => (at === index ? block : current)));
  const replaceBlock = (index: number, blocks: RichTextBlock[]) =>
    onChange([...value.slice(0, index), ...blocks, ...value.slice(index + 1)]);
  const move = (index: number, delta: -1 | 1) => {
    const next = [...value];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };

  return (
    <fieldset className="pb-list pb-richtext">
      <legend>{label}</legend>
      {value.length === 0 && <p className="pb-help">No content yet.</p>}
      {value.map((block, index) => {
        const name = `Block ${index + 1} (${blockSummary(block)})`;
        const isTextBlock = block.type === 'paragraph' || block.type === 'heading' || block.type === 'list';
        return (
          <fieldset className="pb-list-item" key={block.id}>
            <legend>{name}</legend>
            {isTextBlock && (
              <div className="pb-field">
                <label htmlFor={`rt-kind-${block.id}`} className="pb-field-label">
                  Type of block {index + 1}
                </label>
                <select
                  id={`rt-kind-${block.id}`}
                  className="pb-select"
                  value={kindOf(block)}
                  onChange={(event) => replaceBlock(index, convertRichTextBlock(block, event.target.value))}
                >
                  {BLOCK_KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {block.type === 'list' ? (
              <>
                {block.items.map((item, at) => (
                  <div key={item.id}>
                    <RunsEditor
                      label={`Block ${index + 1} item ${at + 1}`}
                      runs={item.children}
                      onChange={(children) =>
                        setBlock(index, {
                          ...block,
                          items: block.items.map((it) => (it.id === item.id ? { ...it, children } : it)),
                        })
                      }
                    />
                    {block.ordered && (
                      <TextField
                        label={`Block ${index + 1} list starting number`}
                        value={block.start === undefined ? '' : String(block.start)}
                        type="number"
                        onChange={(value) =>
                          setBlock(index, { ...block, start: value === '' ? undefined : Number(value) })
                        }
                      />
                    )}
                    {!item.blocks && (
                      <Button
                        variant="quiet"
                        onPress={() =>
                          setBlock(index, {
                            ...block,
                            items: block.items.map((it) =>
                              it.id === item.id ? { ...it, blocks: [createParagraph()] } : it,
                            ),
                          })
                        }
                      >
                        Add nested content to item {at + 1}
                      </Button>
                    )}
                    {item.blocks && (
                      <RichTextEditor
                        label={`Block ${index + 1} item ${at + 1} nested content`}
                        value={item.blocks}
                        onChange={(blocks) =>
                          setBlock(index, {
                            ...block,
                            items: block.items.map((it) => (it.id === item.id ? { ...it, blocks } : it)),
                          })
                        }
                        uploadMedia={uploadMedia}
                      />
                    )}
                    {block.items.length > 1 && (
                      <Button
                        variant="quiet"
                        onPress={() =>
                          setBlock(index, { ...block, items: block.items.filter((it) => it.id !== item.id) })
                        }
                      >
                        Remove block {index + 1} item {at + 1}
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onPress={() =>
                    setBlock(index, {
                      ...block,
                      items: [...block.items, { id: crypto.randomUUID(), children: [createRun()] }],
                    })
                  }
                >
                  Add item to block {index + 1}
                </Button>
              </>
            ) : (
              block.type === 'paragraph' || block.type === 'heading' ? (
                <>
                  <RunsEditor
                    label={`Block ${index + 1} text`}
                    runs={block.children}
                    onChange={(children) => setBlock(index, { ...block, children })}
                  />
                  <label className="pb-field">
                    Text alignment
                    <select
                      className="pb-select"
                      aria-label={`Block ${index + 1} text alignment`}
                      value={block.textAlign ?? 'left'}
                      onChange={(event) =>
                        setBlock(index, {
                          ...block,
                          textAlign: event.target.value as TextAlignment,
                        })
                      }
                    >
                      {['left', 'center', 'right', 'justify'].map((align) => (
                        <option key={align} value={align}>{align}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <RichBlockFields
                  block={block}
                  label={`Block ${index + 1}`}
                  onChange={(next) => setBlock(index, next)}
                  uploadMedia={uploadMedia}
                />
              )
            )}
            <div className="pb-richtext-actions">
              <Button variant="secondary" isDisabled={index === 0} onPress={() => move(index, -1)}>
                Move block {index + 1} up
              </Button>
              <Button
                variant="secondary"
                isDisabled={index === value.length - 1}
                onPress={() => move(index, 1)}
              >
                Move block {index + 1} down
              </Button>
              <Button
                variant="secondary"
                onPress={() => onChange(value.filter((_, at) => at !== index))}
              >
                Remove block {index + 1}
              </Button>
            </div>
          </fieldset>
        );
      })}
      <div className="pb-richtext-actions">
        <Button variant="secondary" onPress={() => onChange([...value, createParagraph()])}>
          Add paragraph
        </Button>
        <Button variant="secondary" onPress={() => onChange([...value, createHeading()])}>
          Add heading
        </Button>
        <Button variant="secondary" onPress={() => onChange([...value, createList()])}>
          Add list
        </Button>
        {([
          ['blockquote', 'Add quote'],
          ['code-block', 'Add code block'],
          ['divider', 'Add divider'],
          ['callout', 'Add callout'],
          ['columns', 'Add columns'],
          ['accordion', 'Add accordion'],
          ['image', 'Add image'],
          ['audio', 'Add audio'],
          ['video', 'Add video'],
          ['youtube', 'Add YouTube video'],
          ['vimeo', 'Add Vimeo video'],
          ['iframe', 'Add embed'],
        ] as const).map(([type, buttonLabel]) => (
          <Button
            key={type}
            variant="secondary"
            onPress={() => onChange([...value, createRichTextBlock(type)])}
          >
            {buttonLabel}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

function RichBlockFields({
  block,
  label,
  onChange,
  uploadMedia,
}: {
  block: Exclude<RichTextBlock, { type: 'paragraph' | 'heading' | 'list' }>;
  label: string;
  onChange: (block: RichTextBlock) => void;
  uploadMedia?: (file: File) => Promise<string>;
}) {
  const textField = (
    fieldLabel: string,
    value: string,
    update: (value: string) => RichTextBlock,
    type: 'text' | 'url' | 'number' = 'text',
  ) => (
    <TextField
      label={`${label} ${fieldLabel}`}
      value={value}
      type={type}
      onChange={(next) => onChange(update(next))}
    />
  );
  const numberField = (
    fieldLabel: string,
    value: number | undefined,
    update: (value: number | undefined) => RichTextBlock,
  ) => textField(fieldLabel, value === undefined ? '' : String(value), (next) => update(next === '' ? undefined : Number(next)), 'number');

  switch (block.type) {
    case 'blockquote':
    case 'callout':
    case 'accordion':
      return (
        <>
          {block.type === 'callout' && (
            <label className="pb-field">
              {label} variant
              <select
                className="pb-select"
                aria-label={`${label} variant`}
                value={block.variant}
                onChange={(event) => onChange({ ...block, variant: event.target.value as typeof block.variant })}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="success">Success</option>
              </select>
            </label>
          )}
          {block.type === 'accordion' && textField('title', block.title, (title) => ({ ...block, title }))}
          <RichTextEditor
            label={`${label} content`}
            value={block.children}
            onChange={(children) => onChange({ ...block, children })}
            uploadMedia={uploadMedia}
          />
        </>
      );
    case 'columns':
      return (
        <div className="pb-richtext-columns-editor">
          {block.columns.map((column, index) => (
            <fieldset key={column.id} className="pb-list-item">
              <legend>{label} column {index + 1}</legend>
              {numberField('width (%)', column.width, (width) => ({
                ...block,
                columns: block.columns.map((entry) => entry.id === column.id ? { ...entry, width } : entry),
              }))}
              <RichTextEditor
                label={`${label} column ${index + 1} content`}
                value={column.children}
                onChange={(children) =>
                  onChange({
                    ...block,
                    columns: block.columns.map((entry) => entry.id === column.id ? { ...entry, children } : entry),
                  })
                }
                uploadMedia={uploadMedia}
              />
              {block.columns.length > 2 && (
                <Button
                  variant="quiet"
                  onPress={() => onChange({ ...block, columns: block.columns.filter((entry) => entry.id !== column.id) })}
                >
                  Remove column {index + 1}
                </Button>
              )}
            </fieldset>
          ))}
          {block.columns.length < 3 && (
            <Button
              variant="secondary"
              onPress={() => onChange({
                ...block,
                columns: [...block.columns, { id: crypto.randomUUID(), children: [createParagraph()] }],
              })}
            >
              Add column
            </Button>
          )}
        </div>
      );
    case 'code-block':
      return (
        <>
          {textField('language', block.language ?? '', (language) => ({ ...block, language }))}
          <label className="pb-field">
            {label} code
            <textarea
              value={block.text}
              maxLength={100_000}
              aria-label={`${label} code`}
              onChange={(event) => onChange({ ...block, text: event.target.value })}
              rows={8}
            />
          </label>
        </>
      );
    case 'divider':
      return <p>A horizontal divider is shown in the page preview.</p>;
    case 'image':
      return <ImageFields block={block} label={label} onChange={onChange} uploadMedia={uploadMedia} />;
    case 'audio':
      return (
        <>
          {textField('audio URL', block.src, (src) => ({ ...block, src }), 'url')}
          {textField('title', block.title ?? '', (title) => ({ ...block, title }))}
        </>
      );
    case 'video':
      return (
        <>
          {textField('video URL', block.src, (src) => ({ ...block, src }), 'url')}
          {textField('title', block.title ?? '', (title) => ({ ...block, title }))}
          {textField('poster URL', block.poster ?? '', (poster) => ({ ...block, poster: poster || undefined }), 'url')}
          {numberField('width (px)', block.width, (width) => ({ ...block, width }))}
          {numberField('height (px)', block.height, (height) => ({ ...block, height }))}
        </>
      );
    case 'youtube':
      return (
        <>
          {textField('video ID', block.videoId, (videoId) => ({ ...block, videoId }))}
          {textField('title', block.title ?? '', (title) => ({ ...block, title }))}
          {numberField('width (px)', block.width, (width) => ({ ...block, width }))}
          {numberField('height (px)', block.height, (height) => ({ ...block, height }))}
        </>
      );
    case 'vimeo':
    case 'iframe':
      return (
        <>
          {textField('source URL', block.src, (src) => ({ ...block, src }), 'url')}
          {textField('accessible title', block.title ?? '', (title) => ({ ...block, title }))}
          {block.type === 'iframe' ? (
            <>
              {textField('width', block.width ?? '100%', (width) => ({ ...block, width }))}
              {textField('height', block.height ?? '400', (height) => ({ ...block, height }))}
            </>
          ) : (
            <>
              {numberField('width (px)', block.width, (width) => ({ ...block, width }))}
              {numberField('height (px)', block.height, (height) => ({ ...block, height }))}
            </>
          )}
        </>
      );
  }
}

const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;

const readImageDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('The image could not be read.'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('The image reader returned an invalid result.'));
    reader.readAsDataURL(file);
  });

function ImageFields({
  block,
  label,
  onChange,
  uploadMedia,
}: {
  block: Extract<RichTextBlock, { type: 'image' }>;
  label: string;
  onChange: (block: RichTextBlock) => void;
  uploadMedia?: (file: File) => Promise<string>;
}) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Choose an image file.');
      return;
    }
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      setUploadError('Images must be 10 MB or smaller.');
      return;
    }
    try {
      const src = uploadMedia ? await uploadMedia(file) : await readImageDataUrl(file);
      onChange({ ...block, src });
      setUploadError(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'The image upload failed.');
    }
  };
  const filesFrom = (files: FileList | null) => {
    const file = files?.item(0);
    if (file) void upload(file);
  };
  const paste = (event: ClipboardEvent<HTMLFieldSetElement>) => {
    const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'));
    if (image) {
      event.preventDefault();
      void upload(image);
    }
  };
  const drop = (event: DragEvent<HTMLFieldSetElement>) => {
    if (!Array.from(event.dataTransfer.files).some((file) => file.type.startsWith('image/'))) return;
    event.preventDefault();
    filesFrom(event.dataTransfer.files);
  };

  return (
    <fieldset
      className="pb-richtext-image"
      aria-label={`${label} image upload`}
      onPaste={paste}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault();
      }}
      onDrop={drop}
    >
      <legend>{label} image</legend>
      <TextField
        label={`${label} image URL`}
        value={block.src}
        type="url"
        onChange={(src) => onChange({ ...block, src })}
      />
      <TextField
        label={`${label} alt text`}
        value={block.alt}
        isRequired
        onChange={(alt) => onChange({ ...block, alt })}
      />
      <TextField
        label={`${label} title`}
        value={block.title ?? ''}
        onChange={(title) => onChange({ ...block, title })}
      />
      <label className="pb-field">
        {label} alignment
        <select
          className="pb-select"
          aria-label={`${label} image alignment`}
          value={block.align ?? 'center'}
          onChange={(event) =>
            onChange({ ...block, align: event.target.value as typeof block.align })
          }
        >
          <option value="left">Left</option>
          <option value="center">Centre</option>
          <option value="right">Right</option>
        </select>
      </label>
      <TextField
        label={`${label} width (px)`}
        value={block.width === undefined ? '' : String(block.width)}
        type="number"
        onChange={(value) => onChange({ ...block, width: value === '' ? undefined : Number(value) })}
      />
      <TextField
        label={`${label} height (px)`}
        value={block.height === undefined ? '' : String(block.height)}
        type="number"
        onChange={(value) => onChange({ ...block, height: value === '' ? undefined : Number(value) })}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        aria-label={`${label} choose image file`}
        onChange={(event) => {
          filesFrom(event.target.files);
          event.target.value = '';
        }}
      />
      <Button variant="secondary" onPress={() => fileInput.current?.click()}>
        Upload image
      </Button>
      <p className="pb-help">
        Or paste an image or drop it in this fieldset. {uploadMedia ? 'Files are uploaded by the host.' : 'Files are stored as local image data.'}
      </p>
      {uploadError && <p role="alert">{uploadError}</p>}
    </fieldset>
  );
}
