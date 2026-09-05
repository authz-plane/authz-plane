import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The default bottom-left badge covers the sidebar's user row.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
