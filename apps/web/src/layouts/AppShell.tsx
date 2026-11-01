//import SiteFooter from '../../components/SiteFooter/SiteFooter';
import Header from "../components/Header/Header";
import styles from "./AppShell.module.css";
import { Outlet } from "react-router-dom";

const AppShell = () => {
  return (
    <div className={styles.appShell}>
      <Header />
      <main className={styles.mainContent} style={{ paddingBottom: "110px" }}>
        <div className={styles.contentContainer}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppShell;