import type { Metadata } from "next";
import { IBM_Plex_Sans, Noto_Naskh_Arabic } from "next/font/google";

import "@/app/globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const arabic = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Quranic Corpus Reader",
  description:
    "Research reader for Quranic Corpus morphology and translation study.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var key="qc.theme";var stored=localStorage.getItem(key);var dark=stored?stored==="dark":true;document.documentElement.classList.toggle("dark",dark);}catch(_e){}})();',
          }}
        />
      </head>
      <body className={`${sans.variable} ${arabic.variable} min-h-dvh font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
