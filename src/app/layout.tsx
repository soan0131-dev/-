import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "입퇴사자 관리 시스템",
  description: "입퇴사 서류 디지털화, 부서별 결재, 전직원 현황판",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
