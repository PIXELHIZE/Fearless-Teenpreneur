import type { Metadata } from "next";
import "./globals.css";
import NotificationManager from "@/components/NotificationManager";

export const metadata: Metadata = {
  title: "캘린더 — 스마트 일정 관리",
  description: "Notion Calendar 스타일 일정 관리 — 드래그로 일정을 만들고 알림을 받아보세요",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="h-full">
        {children}
        <NotificationManager />
      </body>
    </html>
  );
}
