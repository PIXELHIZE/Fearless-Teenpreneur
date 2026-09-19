import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Exam Generator",
  description: "웹 근거 검증을 거친 5지선다 시험지 생성기",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
