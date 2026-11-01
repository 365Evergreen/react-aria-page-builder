import { useEffect, useId, useState } from 'react';
import { Button } from '../primitives/Button/Button';
import { Checkbox } from '../primitives/Checkbox/Checkbox';
import { TextArea, TextField } from '../primitives/TextField/TextField';
import {
  getDefinition,
  getNodeLabel,
  validateField,
  type FieldDef,
} from './definitions';
import { findNode, type PageTree } from './model';
import { RichTextEditor } from './RichTextEditor';
import type { RichTextDoc } from '../page-builder/rich-text';
import type { BuilderAction } from './reducer';

interface PropsPanelProps {
  tree: PageTree;
  selectedId: string | null;
  dispatch: (action: BuilderAction) => void;
  uploadMedia?: (file: File) => Promise<string>;
}

type Values = Record<string, unknown>;

const asText = (value: unknown) =>
  value === undefined || value === null ? '' : String(value);

interface FieldEditorProps {
  field: FieldDef;
  value: unknown;
  siblings?: Values;
  onChange: (value: unknown) => void;
}

function TextualField({ field, value, siblings, onChange }: FieldEditorProps) {
  const [draft, setDraft] = useState(asText(value));
  const error = validateField(field, draft, siblings);

  useEffect(() => {
    // Follow external changes (undo, redo) unless the user is mid-correction.
    setDraft((current) =>
      current !== asText(value) && validateField(field, current, siblings) === null
        ? asText(value)
        : current,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (next: string) => {
    setDraft(next);
    if (validateField(field, next, siblings) !== null) return;
    onChange(field.kind === 'integer' && next.trim() !== '' ? Number(next) : next);
  };

  const Field = field.kind === 'textarea' ? TextArea : TextField;
  return (
    <Field
      label={field.label}
      description={field.description}
      value={draft}
      onChange={handleChange}
      isRequired={field.required}
      isInvalid={error !== null}
      errorMessage={error ?? undefined}
      validationBehavior="aria"
      type={field.kind === 'url' ? 'url' : 'text'}
      inputMode={field.kind === 'integer' ? 'numeric' : undefined}
    />
  );
}

function SelectField({ field, value, onChange }: FieldEditorProps) {
  const id = useId();
  return (
    <div className="pb-field">
      <label htmlFor={id} className="pb-field-label">
        {field.label}
      </label>
      <select
        id={id}
        className="pb-select"
        value={asText(value)}
        onChange={(event) => onChange(event.target.value)}
      >
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ListField({ field, value, onChange }: FieldEditorProps) {
  const items = Array.isArray(value) ? (value as Values[]) : [];
  const name = field.itemName ?? 'item';

  const setItem = (index: number, key: string, next: unknown) =>
    onChange(
      items.map((item, at) => (at === index ? { ...item, [key]: next } : item)),
    );

  return (
    <fieldset className="pb-list">
      <legend>{field.label}</legend>
      {items.length === 0 && (
        <p className="pb-help">No {field.label.toLowerCase()} yet.</p>
      )}
      {items.map((item, index) => (
        <fieldset className="pb-list-item" key={asText(item.id) || index}>
          <legend>
            {name} {index + 1}
          </legend>
          {field.itemFields?.map((sub) => (
            <FieldEditor
              key={sub.key}
              field={sub}
              value={item[sub.key]}
              siblings={item}
              onChange={(next) => setItem(index, sub.key, next)}
            />
          ))}
          <Button
            variant="secondary"
            onPress={() => onChange(items.filter((_, at) => at !== index))}
          >
            Remove {name} {index + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        variant="secondary"
        onPress={() => onChange([...items, field.newItem?.() ?? {}])}
      >
        Add {name}
      </Button>
    </fieldset>
  );
}

function FieldEditor(props: FieldEditorProps & { uploadMedia?: (file: File) => Promise<string> }) {
  switch (props.field.kind) {
    case 'select':
      return <SelectField {...props} />;
    case 'boolean':
      return (
        <Checkbox
          isSelected={props.value === true}
          onChange={(next) => props.onChange(next)}
        >
          {props.field.label}
        </Checkbox>
      );
    case 'richtext':
      return (
        <RichTextEditor
          label={props.field.label}
          value={Array.isArray(props.value) ? (props.value as RichTextDoc) : []}
          onChange={props.onChange}
          uploadMedia={props.uploadMedia}
        />
      );
    case 'list':
      return <ListField {...props} />;
    default:
      return <TextualField {...props} />;
  }
}

export function PropsPanel({ tree, selectedId, dispatch, uploadMedia }: PropsPanelProps) {
  const found = selectedId ? findNode(tree, selectedId) : null;
  const definition = found ? getDefinition(found.node.type) : undefined;

  return (
    <section className="pb-props" aria-labelledby="pb-props-title">
      <h2 id="pb-props-title">Properties</h2>
      {!found || !definition ? (
        <p className="pb-help">Select a block to edit its properties.</p>
      ) : (
        <form
          key={found.node.id}
          onSubmit={(event) => event.preventDefault()}
          aria-label={`${getNodeLabel(found.node)} properties`}
        >
          {definition.fields.map((field) => {
            const scope = field.scope ?? 'data';
            return (
              <FieldEditor
                key={`${scope}.${field.key}`}
                field={field}
                value={(found.node.props[scope] as Values | undefined)?.[field.key]}
                uploadMedia={uploadMedia}
                onChange={(value) =>
                  dispatch({
                    type: 'update',
                    id: found.node.id,
                    field: field.key,
                    value,
                    scope,
                  })
                }
              />
            );
          })}
        </form>
      )}
    </section>
  );
}
