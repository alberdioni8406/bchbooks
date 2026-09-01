import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt =
  'BCHBooks — Simple accounting for Bitcoin Cash. Read-only, privacy-first ledger.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#0f172a',
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #0f766e33 0%, transparent 50%), radial-gradient(circle at 80% 80%, #134e4a44 0%, transparent 45%)',
          padding: 64,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              backgroundColor: '#0f766e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              color: '#5eead4',
              fontWeight: 700,
            }}
          >
            B
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: '#f0fdfa',
              letterSpacing: '-0.02em',
            }}
          >
            BCHBooks
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              maxWidth: 900,
            }}
          >
            Simple accounting for Bitcoin Cash
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#94a3b8',
              lineHeight: 1.4,
              maxWidth: 820,
            }}
          >
            Turn BCH transactions into clear business records. Read-only.
            Privacy-first. Data stays in your browser.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ fontSize: 22, color: '#5eead4', fontWeight: 600 }}>
            Free · No seed phrases · No custody
          </div>
          <div style={{ fontSize: 20, color: '#64748b' }}>
            bchbooks.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
