import { TextArea, TextField } from '../primitives/TextField/TextField';
import { getDefinition, getNodeLabel } from './definitions';
import { findNode, type PageTree } from './model';
import type { BuilderAction } from './reducer';

interface PropsPanelProps {
  tree: PageTree;
  selectedId: string | null;
  dispatch: (action: BuilderAction) => void;
}

export function PropsPanel({ tree, selectedId, dispatch }: PropsPanelProps) {
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
            const raw = found.node.props.data?.[field.key];
            const value = typeof raw === 'string' ? raw : '';
            const Field = field.multiline ? TextArea : TextField;
            return (
              <Field
                key={field.key}
                label={field.label}
                value={value}
                onChange={(next: string) =>
                  dispatch({
                    type: 'update',
                    id: found.node.id,
                    field: field.key,
                    value: next,
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
