import '../src/style.css';
import '../src/upgrade.css';
import '../src/theme.css';

export const metadata = {
  title: '천하제일 손가락 대회 — 리듬게임',
  description: '혼자 또는 친구와 함께 즐기는 브라우저 리듬게임',
};

export const viewport = { themeColor: '#f5f1e8' };

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
