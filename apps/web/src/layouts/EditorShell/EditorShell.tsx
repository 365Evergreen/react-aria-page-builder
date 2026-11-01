import styles from './EditorShell.module.css';

const EditorShell = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.editorShell}>{children}</div>;
};

export default EditorShell;