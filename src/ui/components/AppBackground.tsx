import type { ReactNode } from 'react';

/**
 * Background dekoratif aplikasi dengan gradien halus dan lengkungan gelombang
 * (wave swoosh) di sudut kanan-atas (biru-cyan) dan kanan-bawah (hijau emerald-teal).
 *
 * Menggunakan SVG murni dengan pointer-events: none dan z-index: 0 sehingga
 * tidak menghalangi interaksi, tidak menyebabkan scroll horizontal, dan responsif
 * di semua resolusi layar (360px hingga desktop).
 */
export function AppBackground(): ReactNode {
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="app-bg__gradient" />

      {/* Gelombang kanan-atas bernuansa biru & cyan */}
      <div className="app-bg__waves-top">
        <svg
          viewBox="0 0 600 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="app-bg__svg"
        >
          <defs>
            <linearGradient id="waveTopGrad1" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--wave-top-1, #0284c7)" stopOpacity="0.32" />
              <stop offset="50%" stopColor="var(--wave-top-2, #38bdf8)" stopOpacity="0.20" />
              <stop offset="100%" stopColor="var(--wave-top-2, #7dd3fc)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="waveTopGrad2" x1="100%" y1="20%" x2="10%" y2="85%">
              <stop offset="0%" stopColor="var(--wave-top-2, #0ea5e9)" stopOpacity="0.30" />
              <stop offset="60%" stopColor="var(--wave-top-3, #06b6d4)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--wave-top-3, #22d3ee)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="waveTopGrad3" x1="100%" y1="10%" x2="25%" y2="90%">
              <stop offset="0%" stopColor="var(--wave-top-3, #14b8a6)" stopOpacity="0.25" />
              <stop offset="50%" stopColor="var(--wave-top-2, #2dd4bf)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--wave-top-2, #a5f3fc)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Lapisan 1: Sapuan luas di sudut kanan atas */}
          <path
            d="M600,0 C490,40 380,95 250,105 C140,112 50,90 0,70 L0,0 L600,0 Z"
            fill="url(#waveTopGrad1)"
          />

          {/* Lapisan 2: Pita lengkung utama cyan/biru */}
          <path
            d="M600,30 C490,75 375,125 230,122 C135,120 50,90 0,65 C60,95 155,138 260,136 C405,134 510,75 600,30 Z"
            fill="url(#waveTopGrad2)"
          />

          {/* Lapisan 3: Pita aksen teal/mint */}
          <path
            d="M600,75 C505,115 395,155 275,152 C170,148 70,115 15,90 C90,125 195,168 305,164 C425,160 525,115 600,75 Z"
            fill="url(#waveTopGrad3)"
          />

          {/* Lapisan 4: Garis kilau lembut */}
          <path
            d="M600,120 C515,155 420,185 315,180 C215,175 120,145 50,115 C130,150 230,192 340,190 C450,186 535,155 600,120 Z"
            fill="url(#waveTopGrad1)"
            opacity="0.5"
          />
        </svg>
      </div>

      {/* Gelombang kanan-bawah bernuansa hijau emerald & teal/cyan */}
      <div className="app-bg__waves-bottom">
        <svg
          viewBox="0 0 600 260"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="app-bg__svg"
        >
          <defs>
            <linearGradient id="waveBotGrad1" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="var(--wave-bot-1, #059669)" stopOpacity="0.55" />
              <stop offset="35%" stopColor="var(--wave-bot-1, #10b981)" stopOpacity="0.42" />
              <stop offset="75%" stopColor="var(--wave-bot-2, #34d399)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--wave-bot-2, #a7f3d0)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="waveBotGrad2" x1="100%" y1="80%" x2="0%" y2="10%">
              <stop offset="0%" stopColor="var(--wave-bot-2, #0d9488)" stopOpacity="0.45" />
              <stop offset="50%" stopColor="var(--wave-bot-3, #06b6d4)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--wave-bot-3, #38bdf8)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="waveBotGrad3" x1="100%" y1="90%" x2="20%" y2="0%">
              <stop offset="0%" stopColor="var(--wave-bot-3, #0284c7)" stopOpacity="0.32" />
              <stop offset="55%" stopColor="var(--wave-bot-2, #14b8a6)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--wave-bot-1, #6ee7b7)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Lapisan 1: Dasar hijau emerald melengkung di kanan bawah */}
          <path
            d="M600,260 C490,160 350,130 195,180 C100,212 25,245 0,258 L0,260 Z"
            fill="url(#waveBotGrad1)"
          />

          {/* Lapisan 2: Pita lengkung teal/cyan yang melayang di atasnya */}
          <path
            d="M600,160 C490,120 350,122 200,172 C100,206 20,242 0,255 C35,232 125,188 235,158 C380,118 510,125 600,160 Z"
            fill="url(#waveBotGrad2)"
          />

          {/* Lapisan 3: Pita aksen biru langit / mint */}
          <path
            d="M600,205 C500,158 360,162 210,200 C115,224 30,250 0,260 C40,242 130,210 235,186 C375,152 505,158 600,205 Z"
            fill="url(#waveBotGrad3)"
          />
        </svg>
      </div>
    </div>
  );
}
