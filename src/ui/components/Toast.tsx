// Toast untuk pesan berhasil dan kesalahan. Pesan kesalahan memakai
// role="alert" agar dibacakan pembaca layar; pesan lain role="status".

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

export interface ToastApi {
  show: (text: string, kind?: ToastKind) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Lama tampil toast (ms). 0 = tidak hilang otomatis. */
const DEFAULT_DURATION = 4000;

export function ToastProvider(props: { children?: ReactNode; duration?: number }): ReactNode {
  const duration = props.duration ?? DEFAULT_DURATION;
  const [items, setItems] = useState<ToastMessage[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t !== undefined) clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const show = useCallback(
    (text: string, kind: ToastKind = 'info') => {
      const id = ++seq.current;
      setItems((prev) => [...prev, { id, kind, text }]);
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
    },
    [duration, dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  // API stabil (referensi tetap) yang selalu memanggil implementasi terkini.
  const implRef = useRef({ show, dismiss });
  implRef.current = { show, dismiss };
  const [api] = useState<ToastApi>(() => ({
    show: (text, kind) => implRef.current.show(text, kind),
    success: (text) => implRef.current.show(text, 'success'),
    error: (text) => implRef.current.show(text, 'error'),
    dismiss: (id) => implRef.current.dismiss(id),
  }));

  return (
    <ToastContext.Provider value={api}>
      {props.children}
      <ToastList items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function ToastList(props: { items: readonly ToastMessage[]; onDismiss: (id: number) => void }): ReactNode {
  return (
    <div className="toast-list">
      {props.items.map((m) => (
        <Toast key={m.id} message={m} onDismiss={() => props.onDismiss(m.id)} />
      ))}
    </div>
  );
}

export function Toast(props: { message: ToastMessage; onDismiss?: () => void }): ReactNode {
  const { kind, text } = props.message;
  return (
    <div className={`toast toast--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="toast__text">{text}</span>
      {props.onDismiss ? (
        <button type="button" className="toast__close" aria-label="Tutup pesan" onClick={props.onDismiss}>
          ×
        </button>
      ) : null}
    </div>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast harus dipakai di dalam ToastProvider');
  return api;
}
