import { Outlet } from "react-router";
import styles from "./AppShell.module.css";
import { Header as SiteHeader } from "../components/Header/Header";

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
