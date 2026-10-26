import type { ReactNode } from 'react';
import { APP_INFO } from '../../domain/appInfo';

export function AppCreatorInfo(): ReactNode {
  return (
    <div className="app-creator-card" data-testid="app-creator-info">
      <div className="app-creator-header">
        <div className="app-creator-logo-box">
          <img
            src={APP_INFO.creatorLogoUrl}
            alt={`Logo ${APP_INFO.creatorNama}`}
            className="app-creator-logo-img"
          />
        </div>
        <div className="app-creator-info">
          <h3 className="app-creator-name">{APP_INFO.creatorNama}</h3>
          <p className="app-creator-tagline">{APP_INFO.creatorTagline}</p>
          <div className="app-creator-meta">
            <span className="app-badge-version">
              Versi {APP_INFO.versionName} (Build {APP_INFO.versionCode})
            </span>
            <span className="app-badge-version" style={{ opacity: 0.85 }}>
              {APP_INFO.namaAplikasi}
            </span>
          </div>
        </div>
      </div>
      <p className="app-creator-deskripsi">{APP_INFO.creatorDeskripsi}</p>
    </div>
  );
}
