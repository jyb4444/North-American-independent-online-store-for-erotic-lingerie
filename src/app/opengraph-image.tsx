import { ImageResponse } from 'next/og';

export const alt = 'Self Love intimate apparel';
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
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at top, #3b1824 0%, #160a0f 62%)',
          color: '#f7efe4',
          padding: 80,
        }}
      >
        <div style={{ color: '#d6b96a', fontSize: 24, letterSpacing: 12, textTransform: 'uppercase' }}>
          Private style, thoughtfully selected
        </div>
        <div style={{ fontSize: 88, marginTop: 30, letterSpacing: 18, textTransform: 'uppercase' }}>
          Self Love
        </div>
        <div style={{ width: 160, height: 2, marginTop: 34, background: '#d6b96a' }} />
        <div style={{ fontSize: 30, marginTop: 30, color: '#cfc1b6' }}>
          Intimate Apparel · Lingerie · Hosiery
        </div>
      </div>
    ),
    size,
  );
}
