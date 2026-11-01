import MegaMenu from '../MegaMenu/MegaMenu';
import styles from './SiteHeader.module.css';
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";


interface SiteHeaderProps {
  className?: string
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({ className = "" }) => {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Monitor scrolling to handle the background change animation transition effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Close the drop menu instantly whenever a path changes or layout scales
  const toggleMenu = () => setMenuOpen(!menuOpen)
  const closeMenu = () => setMenuOpen(false)

  return (
    <header
      className={`${styles.headerContainer} ${
        scrolled ? styles.scrolled : ""
      } ${className}`}
    >
      {/* 1. Logo Left Block Context (Stays on the left margin) */}
      <div className={styles.left}>
        <Link to="/" className={styles.brand} onClick={closeMenu}>
          <img
            src="https://blog.paulibaby.com/paulibaby.png"
            alt="Paulibaby logo"
            className={styles.brandLogo}
          /></Link>
          <div className={styles.brandText}>Paulibaby</div>
        
      </div>

      {/* 2. 🍔 Responsive Hamburger Trigger (MOVED HERE TO FIX THE POSITIONING BUG) */}
      <button
        type="button"
        className={`${styles.hamburgerBtn} ${
          menuOpen ? styles.isHamburgerActive : ""
        }`}
        onClick={toggleMenu}
        aria-label="Toggle navigation menu"
        aria-expanded={menuOpen}
      >
        <span className={styles.hamburgerBar}></span>
        <span className={styles.hamburgerBar}></span>
        <span className={styles.hamburgerBar}></span>
      </button>

      {/* 3. Navigation Wrapper Grid Overlay Layer Container */}
      <div className={`${styles.siteNav} ${menuOpen ? styles.isMenuOpen : ""}`}>
        <MegaMenu onItemClick={closeMenu}  />
      </div>
    </header>
  )
}
export default SiteHeader