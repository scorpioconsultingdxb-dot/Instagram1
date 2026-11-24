import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Viewora — See Beyond the Profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: 'linear-gradient(135deg, #080D19 0%, #131C2E 60%, #1E1B4B 100%)',
          color: '#F8FAFC',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #7957FF, #22D3EE)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 800,
              color: '#FFFFFF',
            }}
          >
            V
          </div>
          <span style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Viewora
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '880px' }}>
          <div style={{ fontSize: '64px', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.03em' }}>
            See Beyond the Profile.
          </div>
          <div style={{ fontSize: '26px', color: '#94A3B8', lineHeight: 1.4 }}>
            Privacy-first Instagram intelligence, 12 free tools, transparent data provenance &amp;
            AI-powered analytics.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #263047',
            paddingTop: '24px',
            fontSize: '20px',
            color: '#A99AFF',
          }}
        >
          <span>Explore More. Discover More.</span>
          <span style={{ color: '#22D3EE' }}>Public &amp; Authorized Data Only</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
