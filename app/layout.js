import './globals.css';
import './home.css';
import './lesson.css';

export const metadata = {
  title: '기본학습',
  description: 'OX 퀴즈, 카드 뒤집기, 따라쓰기, 따라말하기 기본학습',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="device">{children}</div>
      </body>
    </html>
  );
}
