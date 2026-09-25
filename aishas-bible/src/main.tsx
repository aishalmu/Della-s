import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import './styles.css';
import { App } from './App';
import { NavProvider } from './lib/nav';
import { StoreProvider } from './lib/store';

// Ask the browser not to clear this app's storage when space runs low.
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <NavProvider>
        <App />
      </NavProvider>
    </StoreProvider>
  </StrictMode>,
);
