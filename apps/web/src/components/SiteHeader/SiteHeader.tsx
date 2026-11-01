import MegaMenu from '../MegaMenu/MegaMenu';
import styles from './SiteHeader.module.css';

export function SiteHeader() {
  return (
    <header className={styles.siteHeader}>
      <nav>
        <a href="/issues">Issue dashboard</a>
        <a href="/editor">Page builder</a>
        <MegaMenu />
      </nav>
    </header>
  );
}
export default SiteHeader;