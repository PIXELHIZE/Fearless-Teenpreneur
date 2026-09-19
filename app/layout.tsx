import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "teum — Interface System",
  description: "White, black, one blue. 공용 컴포넌트 · 디자인 규칙 · GSAP 모션 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body><TooltipProvider>{children}</TooltipProvider></body></html>;
}
