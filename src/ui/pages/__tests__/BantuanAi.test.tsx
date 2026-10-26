// Unit test tombol "Bantuan AI" pada formulir sesi terapi.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildPromptTcm } from '../../../domain/bantuanAi';
import type { ClipboardGateway } from '../../../infra/clipboardGateway';
import type { ExternalLinkGateway } from '../../../infra/externalLink';
import { DexieRepository, openRepository } from '../../../infra/repository';
import { DataStore, DataStoreProvider } from '../../../state/dataStore';
import { DialogStackProvider } from '../../components/DialogStack';
import { ToastProvider } from '../../components/Toast';
import { SesiFormDialog } from '../sesi/SesiFormDialog';

let counter = 0;
const opened: DexieRepository[] = [];

afterEach(async () => {
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

const JAWABAN =
  'DIAGNOSA TCM: Yao Tong (nyeri pinggang)\nPOLA: Defisiensi Yang Ginjal\nPRINSIP TERAPI: Menghangatkan dan menguatkan Yang Ginjal';

async function setup() {
  const repo = await openRepository(`test-bantuan-ai-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  const store = new DataStore({ repository: repo });
  await store.load();
  const r = await store.addPasien({ nama: 'Budi Santoso', alamat: 'Jl. Mawar 1', noHp: '081234567890' });
  if (!r.ok) throw new Error('seed pasien gagal');

  let clip = '';
  const link: ExternalLinkGateway = { open: vi.fn(async () => true) };
  const clipboard: ClipboardGateway = {
    readText: vi.fn(async () => clip),
    writeText: vi.fn(async (t: string) => {
      clip = t;
      return true;
    }),
  };
  render(
    <DataStoreProvider store={store}>
      <DialogStackProvider>
        <ToastProvider duration={0}>
          <SesiFormDialog open pasienId={r.value.id} onClose={() => {}} linkGateway={link} clipboardGateway={clipboard} />
        </ToastProvider>
      </DialogStackProvider>
    </DataStoreProvider>,
  );
  const formDialog = screen.getByRole('dialog', { name: 'Tambah Sesi Terapi' });
  return { link, clipboard, formDialog, setClip: (t: string) => (clip = t) };
}

describe('Bantuan AI pada formulir sesi', () => {
  it('keluhan kosong: tidak membuka ChatGPT dan menampilkan pesan pada Keluhan', async () => {
    const user = userEvent.setup();
    const { link, formDialog } = await setup();

    await user.click(within(formDialog).getByRole('button', { name: 'Bantuan AI' }));

    expect(link.open).not.toHaveBeenCalled();
    expect(within(formDialog).getByText('Isi keluhan terlebih dahulu untuk Bantuan AI')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Bantuan AI (TCM)' })).not.toBeInTheDocument();
  });

  it('membuka ChatGPT dengan prompt keluhan saja, lalu jawaban dari clipboard mengisi Diagnosa & Terapi', async () => {
    const user = userEvent.setup();
    const { link, clipboard, formDialog, setClip } = await setup();

    await user.type(within(formDialog).getByLabelText('Keluhan'), 'Nyeri pinggang, kaki dingin');
    await user.click(within(formDialog).getByRole('button', { name: 'Bantuan AI' }));

    // ChatGPT dibuka dengan prompt TCM; nama pasien tidak ikut terkirim.
    expect(link.open).toHaveBeenCalledTimes(1);
    const url = new URL(vi.mocked(link.open).mock.calls[0]![0]);
    expect(url.origin).toBe('https://chatgpt.com');
    const q = url.searchParams.get('q')!;
    expect(q).toBe(buildPromptTcm('Nyeri pinggang, kaki dingin'));
    expect(q).not.toContain('Budi');
    expect(clipboard.writeText).toHaveBeenCalledWith(q);

    const ai = screen.getByRole('dialog', { name: 'Bantuan AI (TCM)' });
    const tombolCopy = within(ai).getByRole('button', { name: 'Copy ke Formulir' });
    expect(tombolCopy).toBeDisabled();

    // Kembali ke aplikasi dengan clipboard masih berisi prompt → diabaikan.
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(within(ai).getByLabelText('Jawaban AI')).toHaveValue('');

    // Pengguna menekan "Copy" di ChatGPT lalu kembali → terisi otomatis.
    setClip(JAWABAN);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(within(ai).getByLabelText('Jawaban AI')).toHaveValue(JAWABAN);
    expect(tombolCopy).toBeEnabled();

    await user.click(tombolCopy);

    expect(screen.queryByRole('dialog', { name: 'Bantuan AI (TCM)' })).not.toBeInTheDocument();
    expect(within(formDialog).getByLabelText('Diagnosa')).toHaveValue(
      'Yao Tong (nyeri pinggang)\nPola: Defisiensi Yang Ginjal',
    );
    expect(within(formDialog).getByLabelText('Terapi yang diberikan')).toHaveValue(
      'Prinsip terapi: Menghangatkan dan menguatkan Yang Ginjal',
    );
  });

  it('jawaban dapat ditempel manual; format tidak dikenali menampilkan pesan', async () => {
    const user = userEvent.setup();
    const { formDialog } = await setup();

    await user.type(within(formDialog).getByLabelText('Keluhan'), 'Batuk berdahak');
    await user.click(within(formDialog).getByRole('button', { name: 'Bantuan AI' }));
    const ai = screen.getByRole('dialog', { name: 'Bantuan AI (TCM)' });
    const textarea = within(ai).getByLabelText('Jawaban AI');

    await user.type(textarea, 'jawaban bebas tanpa format');
    expect(within(ai).getByRole('alert')).toHaveTextContent('Format jawaban AI belum dikenali');
    expect(within(ai).getByRole('button', { name: 'Copy ke Formulir' })).toBeDisabled();

    await user.clear(textarea);
    await user.click(textarea);
    await user.paste('Diagnosa: Ke Sou\nPola: Lembap-dahak di Paru\nPrinsip terapi: Mengeringkan lembap, mengubah dahak');
    await user.click(within(ai).getByRole('button', { name: 'Copy ke Formulir' }));

    expect(within(formDialog).getByLabelText('Diagnosa')).toHaveValue('Ke Sou\nPola: Lembap-dahak di Paru');
    expect(within(formDialog).getByLabelText('Terapi yang diberikan')).toHaveValue(
      'Prinsip terapi: Mengeringkan lembap, mengubah dahak',
    );
  });
});
