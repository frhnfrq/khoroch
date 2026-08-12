import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata, Viewport } from "next";

import "../index.css";

import Providers from "@/components/providers";
import { ServiceWorkerCleanup } from "@/components/service-worker-cleanup";

export const metadata: Metadata = {
  title: {
    default: "Khoroch",
    template: "%s · Khoroch",
  },
  description: "A calm, complete view of your accounts, spending, income, and budgets.",
  applicationName: "Khoroch",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Khoroch",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7252c7" },
    { media: "(prefers-color-scheme: dark)", color: "#17131f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClerkProvider appearance={{ theme: shadcn }} dynamic>
          <Providers>
            {children}
            <ServiceWorkerCleanup />
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
