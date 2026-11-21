import type { Metadata } from "next";
import Script from "next/script";

import "@fontsource-variable/manrope";
import "./globals.css";
import "./student-ui.css";
import "./qr-ui.css";
import "./staff-ui.css";

export const metadata: Metadata = {
  title: "Цифровой деканат",
  description: "Расписание, успеваемость, справки и навигация по кампусу.",
};

const themeInit = 'try{document.documentElement.dataset.theme=localStorage.getItem("dekanat-theme")==="dark"?"dark":"light"}catch{}';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ru" suppressHydrationWarning><body>
    {/* next/script вместо сырого <script>: React не ругается на script-тег в компоненте,
        а тема применяется до отрисовки страницы. */}
    <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInit }} />
    {children}
  </body></html>;
}
