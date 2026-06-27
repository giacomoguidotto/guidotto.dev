import type { MetadataRoute } from "next";
import { content } from "~/content";

const STAGE_DEEP = "#06070c";

export default function manifest(): MetadataRoute.Manifest {
  const { site } = content;

  return {
    name: site.title,
    short_name: "guidotto.dev",
    description: site.description,
    lang: site.locale,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: STAGE_DEEP,
    theme_color: STAGE_DEEP,
    icons: [
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/logo-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
