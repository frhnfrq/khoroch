import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "Khoroch — Personal Money Tracker",
    short_name: "Khoroch",
    description: "Track accounts, expenses, income, transfers, and monthly budgets.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f9f8fc",
    theme_color: "#7252c7",
    orientation: "portrait-primary",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/favicon/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "View activity",
        short_name: "Activity",
        url: "/transactions",
        icons: [
          {
            src: "/favicon/web-app-manifest-192x192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "View accounts",
        short_name: "Accounts",
        url: "/accounts",
        icons: [
          {
            src: "/favicon/web-app-manifest-192x192.png",
            sizes: "192x192",
          },
        ],
      },
    ],
  };
}
