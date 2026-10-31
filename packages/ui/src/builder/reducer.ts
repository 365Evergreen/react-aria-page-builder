import {
  canHaveChildren,
  createNode,
  getDefinition,
  getNodeLabel,
} from './definitions';
import {
  cloneWithNewIds,
  containsNode,
  findNode,
  getSiblings,
  insertIntoTree,
  removeFromTree,
  updateInTree,
  type PageNode,
  type PageTree,
} from './model';

const HISTORY_LIMIT = 100;

export interface BuilderState {
  tree: PageTree;
  selectedId: string | null;
  past: PageTree[];
  future: PageTree[];
  announcement: string;
  /** Set when an edit should move focus to this block. */
  focusId: string | null;
  lastEditKey: string | null;
}

export type BuilderAction =
  | {
      type: 'add';
      blockType: string;
      parentId: string | null;
      index: number;
      id?: string;
    }
  | { type: 'move'; id: string; parentId: string | null; index: number }
  | { type: 'moveBy'; id: string; delta: -1 | 1 }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string; newId?: () => string }
  | {
      type: 'update';
      id: string;
      field: string;
      value: unknown;
      scope?: 'data' | 'styles';
    }
  | { type: 'load'; tree: PageTree; message?: string }
  | { type: 'select'; id: string | null }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clearFocus' };

export const createInitialState = (tree: PageTree = []): BuilderState => ({
  tree,
  selectedId: null,
  past: [],
  future: [],
  announcement: '',
  focusId: null,
  lastEditKey: null,
});

const commit = (
  state: BuilderState,
  tree: PageTree,
  extra: Partial<BuilderState>,
): BuilderState => ({
  ...state,
  tree,
  past: [...state.past, state.tree].slice(-HISTORY_LIMIT),
  future: [],
  lastEditKey: null,
  focusId: null,
  ...extra,
});

const say = (state: BuilderState, announcement: string): BuilderState => ({
  ...state,
  announcement,
  focusId: null,
});

const nameOf = (tree: PageTree, id: string) => {
  const found = findNode(tree, id);
  return found ? getNodeLabel(found.node) : 'Block';
};

const position = (tree: PageTree, id: string) => {
  const found = findNode(tree, id);
  if (!found) return '';
  const siblings = getSiblings(tree, found.parentId);
  return `position ${found.index + 1} of ${siblings.length}`;
};

/** Index is the final index within the parent's children after removal. */
export const moveInTree = (
  tree: PageTree,
  id: string,
  parentId: string | null,
  index: number,
): PageTree | null => {
  const found = findNode(tree, id);
  if (!found) return null;
  if (parentId !== null) {
    const parent = findNode(tree, parentId);
    if (!parent || !canHaveChildren(parent.node.type)) return null;
    if (containsNode(found.node, parentId)) return null;
  }
  return insertIntoTree(removeFromTree(tree, id), parentId, index, found.node);
};

export function builderReducer(
  state: BuilderState,
  action: BuilderAction,
): BuilderState {
  switch (action.type) {
    case 'add': {
      if (!getDefinition(action.blockType)) return state;
      const node: PageNode = createNode(action.blockType, action.id);
      if (action.parentId !== null) {
        const parent = findNode(state.tree, action.parentId);
        if (!parent || !canHaveChildren(parent.node.type)) return state;
      }
      const tree = insertIntoTree(state.tree, action.parentId, action.index, node);
      return commit(state, tree, {
        selectedId: node.id,
        focusId: node.id,
        announcement: `${getNodeLabel(node)} added, ${position(tree, node.id)}.`,
      });
    }

    case 'move': {
      const tree = moveInTree(state.tree, action.id, action.parentId, action.index);
      if (!tree) return say(state, 'That block cannot be moved there.');
      return commit(state, tree, {
        selectedId: action.id,
        focusId: action.id,
        announcement: `${nameOf(tree, action.id)} moved, ${position(tree, action.id)}.`,
      });
    }

    case 'moveBy': {
      const found = findNode(state.tree, action.id);
      if (!found) return state;
      const siblings = getSiblings(state.tree, found.parentId);
      const target = found.index + action.delta;
      if (target < 0 || target >= siblings.length) {
        return {
          ...say(
            state,
            `${getNodeLabel(found.node)} is already ${action.delta < 0 ? 'first' : 'last'}.`,
          ),
          focusId: action.id,
        };
      }
      const tree = moveInTree(state.tree, action.id, found.parentId, target)!;
      return commit(state, tree, {
        focusId: action.id,
        announcement: `${getNodeLabel(found.node)} moved ${action.delta < 0 ? 'up' : 'down'}, ${position(tree, action.id)}.`,
      });
    }

    case 'remove': {
      const found = findNode(state.tree, action.id);
      if (!found) return state;
      const siblings = getSiblings(state.tree, found.parentId);
      const neighbour = siblings[found.index + 1] ?? siblings[found.index - 1];
      const nextId = neighbour?.id ?? found.parentId;
      const tree = removeFromTree(state.tree, action.id);
      return commit(state, tree, {
        selectedId: nextId,
        focusId: nextId,
        announcement: `${getNodeLabel(found.node)} deleted.`,
      });
    }

    case 'duplicate': {
      const found = findNode(state.tree, action.id);
      if (!found) return state;
      const copy = cloneWithNewIds(
        found.node,
        action.newId ?? (() => crypto.randomUUID()),
      );
      const tree = insertIntoTree(
        state.tree,
        found.parentId,
        found.index + 1,
        copy,
      );
      return commit(state, tree, {
        selectedId: copy.id,
        focusId: copy.id,
        announcement: `${getNodeLabel(found.node)} duplicated, ${position(tree, copy.id)}.`,
      });
    }

    case 'update': {
      if (!findNode(state.tree, action.id)) return state;
      const tree = updateInTree(state.tree, action.id, (node) => ({
        ...node,
        props: {
          ...node.props,
          data: { ...node.props.data, [action.field]: action.value },
        },
      }));
      const key = `${action.id}:${action.field}`;
      if (state.lastEditKey === key) {
        return { ...state, tree, future: [], focusId: null };
      }
      return commit(state, tree, { lastEditKey: key });
    }

    case 'load':
      return commit(state, action.tree, {
        selectedId: null,
        announcement: action.message ?? 'Page loaded.',
      });

    case 'select':
      return { ...state, selectedId: action.id };

    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return say(state, 'Nothing to undo.');
      return {
        ...state,
        tree: previous,
        past: state.past.slice(0, -1),
        future: [state.tree, ...state.future],
        selectedId: keepSelection(previous, state.selectedId),
        lastEditKey: null,
        focusId: null,
        announcement: 'Undone.',
      };
    }

    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next) return say(state, 'Nothing to redo.');
      return {
        ...state,
        tree: next,
        past: [...state.past, state.tree],
        future: rest,
        selectedId: keepSelection(next, state.selectedId),
        lastEditKey: null,
        focusId: null,
        announcement: 'Redone.',
      };
    }

    case 'clearFocus':
      return state.focusId === null ? state : { ...state, focusId: null };

    default:
      return state;
  }
}

const keepSelection = (tree: PageTree, id: string | null) =>
  id && findNode(tree, id) ? id : null;
