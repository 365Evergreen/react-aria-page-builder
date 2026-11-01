import React, { useState } from "react";
import menuData from "./megaMenu.json";
import styles from "./MegaMenu.module.css";
import { useIsAuthenticated } from "../../hooks/useIsAuthenticated";

interface MegaMenuProps {
  onItemClick?: () => void;
}

const MegaMenu: React.FC<MegaMenuProps> = ({ onItemClick }) => {
  const [activeMenuId, setActiveMenuId] = useState<string | number | null>(
    null,
  );
  const isAuthenticated = useIsAuthenticated();
  const visibleNav = menuData.filter(
    (item) => !item.requiresAuth || isAuthenticated,
  );

  // Safely trigger mobile tap vs desktop hover navigation
  const handleItemClick = (e: React.MouseEvent, item: (typeof menuData)[0]) => {
    if (item.hasMegaMenu) {
      // On mobile screens or devices where click must act as the panel trigger
      if (window.innerWidth < 768) {
        e.preventDefault(); // Stop immediate redirect so user can see menu options
        setActiveMenuId(activeMenuId === item.id ? null : item.id);
      } else {
        // Desktop can handle native redirect or standard click closures if necessary
        onItemClick?.();
      }
    } else {
      onItemClick?.();
    }
  };

  return (
    <nav className={styles.navBar} aria-label="Main Navigation">
      <ul className={styles.navLinks}>
        {visibleNav.map((item) => (
          <li
            key={item.id}
            className={`${styles.navItem} ${
              activeMenuId === item.id ? styles.isActiveItem : ""
            }`}
            // Keep hover actions alive for seamless desktop interaction tracks
            onMouseEnter={() =>
              window.innerWidth >= 768 && setActiveMenuId(item.id)
            }
            onMouseLeave={() =>
              window.innerWidth >= 768 && setActiveMenuId(null)
            }
          >
            <a
              href={item.href}
              className={styles.navLink}
              onClick={(e) => handleItemClick(e, item)}
            >
              {item.title}
              {item.hasMegaMenu && (
                <span
                  className={`${styles.arrow} ${
                    activeMenuId === item.id ? styles.arrowOpen : ""
                  }`}
                >
                  ▼
                </span>
              )}
            </a>

            {/* Megamenu layout block container */}
            {item.hasMegaMenu && activeMenuId === item.id && (
              <div className={styles.megamenuDropdown}>
                <div className={styles.megamenuGrid}>
                  {item.columns?.map((column, colIdx) => (
                    // ✅ Cleaned up all global class name bugs to use strict modules mapping
                    <div key={colIdx} className={styles.megamenuColumn}>
                      <h4 className={styles.columnHeading}>{column.heading}</h4>
                      <ul className={styles.columnLinks}>
                        {column.links
                          .filter(
                            (link) =>
                              !("requiresAuth" in link) || isAuthenticated,
                          )
                          .map((link, linkIdx) => (
                            <li key={linkIdx}>
                              <a
                                href={link.href}
                                className={styles.subLink}
                                onClick={() => onItemClick?.()} // Close the hamburger layer when navigating
                              >
                                {link.label}
                              </a>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default MegaMenu;