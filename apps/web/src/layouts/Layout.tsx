import { Outlet } from "react-router-dom";
import styles from "./AppShell.module.css";
import { SiteHeader } from "../components/SiteHeader/SiteHeader";

export function Layout() {


  return (
    <div className={styles.appShell}>
      <SiteHeader />
      <main className={styles.mainContent} style={{ paddingBottom: "110px" }}>
        <div className={styles.contentContainer}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
