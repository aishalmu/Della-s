import { useEffect, useRef, useState } from 'react';
import { BackupDialog, readLastBackup } from './components/BackupDialog';
import { NAV, NAV_GROUPS, type PageId } from './lib/constants';
import { daysBetween, stampLabel } from './lib/dates';
import { useNav } from './lib/nav';
import { useStore } from './lib/store';
import { Budget, Care, Cleaning, Goals, Habits, Meals } from './pages/LifePages';
import { Crochet, Create, Pilates, Reading, Travel } from './pages/LovesPages';
import { Day, Home, Month, Week, Year } from './pages/PlannerPages';

const PAGES: Record<PageId, () => React.JSX.Element> = {
  home: Home, year: Year, month: Month, week: Week, day: Day,
  goals: Goals, habits: Habits, budget: Budget, meals: Meals, cleaning: Cleaning, care: Care,
  reading: Reading, crochet: Crochet, create: Create, pilates: Pilates, travel: Travel,
};

function backupNote(last: Date | null, today: Date) {
  if (!last) return { text: 'Not backed up yet', warn: true };
  const n = daysBetween(last, today);
  const text = n <= 0 ? 'Backed up today' : n === 1 ? 'Backed up yesterday' : `Last backup ${n} days ago`;
  return { text, warn: n > 14 };
}

export function App() {
  const { page, setPage, today } = useNav();
  const { saved } = useStore();
  const main = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [lastBackup, setLastBackup] = useState(readLastBackup);
  const Page = PAGES[page];
  const note = backupNote(lastBackup, today);

  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [page]);

  const go = (id: PageId) => {
    setPage(id);
    setMenuOpen(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-title">{NAV.find(([id]) => id === page)?.[1]}</span>
        <button className="btn-secondary" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="sidebar">Menu</button>
      </header>
      <div className={menuOpen ? 'scrim open' : 'scrim'} onClick={() => setMenuOpen(false)} />
      <nav id="sidebar" className={menuOpen ? 'sidebar open' : 'sidebar'} aria-label="Pages">
        <div className="stamp-wrap">
          <div className="stamp">
            <div className="stamp-small">Passport · Life</div>
            <div className="stamp-name">Aisha’s<br />Bible</div>
            <div className="stamp-small dates">{stampLabel()}</div>
          </div>
        </div>
        {NAV_GROUPS.map(([group, items]) => (
          <div key={group} className="stack" style={{ gap: 2 }}>
            <div className="nav-group">{group}</div>
            {items.map(([id, label]) => (
              <button key={id} className="nav-item" aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>
                {label}
              </button>
            ))}
          </div>
        ))}
        <div className="nav-backup">
          <button className="btn-secondary" onClick={() => { setBackupOpen(true); setMenuOpen(false); }}>Backup &amp; restore</button>
          <div className={note.warn ? 'nav-backup-note warn' : 'nav-backup-note'}>{note.text}</div>
        </div>
      </nav>
      <main ref={main} className="main">
        <div className="content">
          <Page />
        </div>
      </main>
      {backupOpen && <BackupDialog onClose={() => setBackupOpen(false)} onBackedUp={() => setLastBackup(readLastBackup())} />}
      {!saved && (
        <div className="save-warning" role="alert">
          Your latest changes couldn’t be saved on this device. Export a backup now.
        </div>
      )}
    </div>
  );
}
