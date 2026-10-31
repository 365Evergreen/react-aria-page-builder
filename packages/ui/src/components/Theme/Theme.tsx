import styles from './Theme.module.css';

export const Theme = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.theme}>{children}</div>;
};
export default Theme;