import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Democracy Routes",
    short_name: "Democracy Routes",
    description: "Civic meeting and template platform",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3ea",
    theme_color: "#f97316",
    icons: [
      {
        src: "/dr-tree-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/dr-tree-512.png",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/dr-tree-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
