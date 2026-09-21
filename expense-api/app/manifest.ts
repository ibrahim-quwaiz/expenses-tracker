import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مصروفاتي",
    short_name: "مصروفاتي",
    description: "تطبيق لتسجيل المصروفات الشخصية وتتبع الميزانية",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F5F6",
    theme_color: "#2E5C8A",
    lang: "ar",
    dir: "rtl",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
