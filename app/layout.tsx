import type { Metadata } from "next";

import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "Цифровой деканат",
  description: "Расписание, успеваемость, справки и навигация по кампусу.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ru" suppressHydrationWarning><body><script dangerouslySetInnerHTML={{ __html:
    'try{document.documentElement.dataset.theme=localStorage.getItem("dekanat-theme")==="dark"?"dark":"light"}catch{}'
  }} />{children}</body></html>;
}