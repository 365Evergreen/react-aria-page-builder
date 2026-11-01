import styles from './EditorShell.module.css'
import { Outlet } from 'react-router-dom';
 
export function EditorShell() {
    

    return (
        <div className={styles.editorShell}>

            <main className={styles.mainContainer}>
                <Outlet />
            </main>

        </div>
    );
}

export default EditorShell