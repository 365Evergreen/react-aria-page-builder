import { useEffect, useState } from 'react';
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
  createRun,
  getLinkHref,
  hasMark,
  setLink,
  toggleMark,
  type HeadingLevel,
  type RichTextBlock,
  type RichTextDoc,
  type TextRun,
} from '../page-builder/rich-text';

type SimpleMark = 'bold' | 'italic' | 'code';
const MARKS: { key: SimpleMark; label: string }[] = [
  { key: 'bold', label: 'Bold' },
  { key: 'italic', label: 'Italic' },
  { key: 'code', label: 'Code' },
];

const BLOCK_KINDS = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'heading-2', label: 'Heading level 2' },
  { value: 'heading-3', label: 'Heading level 3' },
  { value: 'heading-4', label: 'Heading level 4' },
  { value: 'list-bullet', label: 'Bulleted list' },
  { value: 'list-number', label: 'Numbered list' },
];

const kindOf = (block: RichTextBlock) =>
  block.type === 'heading'
    ? `heading-${block.level}`
    : block.type === 'list'
      ? block.ordered
        ? 'list-number'
        : 'list-bullet'
      : 'paragraph';

const blockSummary = (block: RichTextBlock) =>
  BLOCK_KINDS.find((kind) => kind.value === kindOf(block))?.label ?? 'Block';

const runsOf = (block: RichTextBlock): TextRun[] =>
  block.type === 'list' ? (block.items[0]?.children ?? [createRun()]) : block.children;

/** Converts a block to another kind, keeping its text. */
const convertBlock = (block: RichTextBlock, kind: string): RichTextBlock => {
  const runs = runsOf(block);
  if (kind === 'paragraph') return { id: block.id, type: 'paragraph', children: runs };
  if (kind.startsWith('heading-')) {
    return {
      id: block.id,
      type: 'heading',
      level: Number(kind.slice(-1)) as HeadingLevel,
      children: runs,
    };
  }
  const ordered = kind === 'list-number';
  if (block.type === 'list') return { ...block, ordered };
  return { id: block.id, type: 'list', ordered, items: [{ id: crypto.randomUUID(), children: runs }] };
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
}

export function RichTextEditor({ label, value, onChange }: RichTextEditorProps) {
  const setBlock = (index: number, block: RichTextBlock) =>
    onChange(value.map((current, at) => (at === index ? block : current)));
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
        return (
          <fieldset className="pb-list-item" key={block.id}>
            <legend>{name}</legend>
            <div className="pb-field">
              <label htmlFor={`rt-kind-${block.id}`} className="pb-field-label">
                Type of block {index + 1}
              </label>
              <select
                id={`rt-kind-${block.id}`}
                className="pb-select"
                value={kindOf(block)}
                onChange={(event) => setBlock(index, convertBlock(block, event.target.value))}
              >
                {BLOCK_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </div>
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
              <RunsEditor
                label={`Block ${index + 1} text`}
                runs={block.children}
                onChange={(children) => setBlock(index, { ...block, children })}
              />
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
      </div>
    </fieldset>
  );
}
