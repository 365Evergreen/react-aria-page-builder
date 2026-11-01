import SiteHeader from "../../components/SiteHeader/SiteHeader";
import styles from './AppShell.module.css';

import { Outlet } from "react-router-dom";
const AppShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className={styles.appShell}>
      <SiteHeader />
      <Outlet />
    </div>
  );
};

export default AppShell;