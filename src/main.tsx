import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { openRepository } from './infra/repository';
import { createDataStore } from './state/dataStore';
import { App } from './ui/App';
import './ui/styles.css';

// Repository dibuka di dalam load() sehingga kegagalan membuka basis data
// menjadi layar "Data gagal dimuat" yang dapat dicoba lagi (Req 10.6).
const store = createDataStore({ repository: () => openRepository() });
void store.load();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );
}
