// NomorWhatsApp: tombol aksi chat WhatsApp langsung dari nomor HP (Requirement 12).

import { type MouseEvent } from 'react';
import { tautanWhatsApp } from '../../domain/whatsapp';
import { createExternalLinkGateway, type ExternalLinkGateway } from '../../infra/externalLink';
import { useToast } from './Toast';

export interface NomorWhatsAppProps {
  noHp: string;
  nama: string;
  gateway?: ExternalLinkGateway;
  className?: string;
}

export function NomorWhatsApp({ noHp, nama, gateway, className = '' }: NomorWhatsAppProps) {
  const toast = useToast();
  const linkGw = gateway ?? createExternalLinkGateway();

  const trimmed = noHp ? noHp.trim() : '';
  if (!trimmed) {
    return <span>-</span>;
  }

  const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const url = tautanWhatsApp(trimmed);
    const success = await linkGw.open(url);
    if (!success) {
      toast.error(`WhatsApp tidak dapat dibuka. Nomor HP: ${trimmed}`);
    }
  };

  return (
    <button
      type="button"
      className={`btn-whatsapp ${className}`.trim()}
      onClick={handleClick}
      aria-label={`Chat WhatsApp ${nama}`}
      title={`Chat WhatsApp ${nama}`}
    >
      <span className="btn-whatsapp-icon" aria-hidden="true">
        💬
      </span>
      <span className="btn-whatsapp-text">{trimmed}</span>
    </button>
  );
}
