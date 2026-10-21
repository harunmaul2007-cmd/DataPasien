// Setup global Vitest:
// - fake-indexeddb/auto memasang implementasi IndexedDB in-memory pada globalThis
//   sehingga Dexie dapat diuji di jsdom.
// - jest-dom menambahkan matcher DOM (toBeInTheDocument, dll.).
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
