import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
          borderRadius: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="130" height="150" viewBox="0 0 130 150" fill="none">
          <circle cx="75" cy="22" r="14" fill="#be185d" />
          <circle cx="63" cy="11" r="7" fill="#be185d" />
          <path d="M 65 36 C 48 60 32 88 28 118" stroke="#be185d" strokeWidth="10" strokeLinecap="round" />
          <path d="M 80 44 C 100 30 118 18 128 8" stroke="#be185d" strokeWidth="9" strokeLinecap="round" />
          <path d="M 68 78 C 90 84 112 80 128 74" stroke="#be185d" strokeWidth="9" strokeLinecap="round" />
          <path d="M 28 118 C 25 132 23 142 22 150" stroke="#be185d" strokeWidth="9" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
