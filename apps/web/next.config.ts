import "@khoroch/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: { position: "bottom-right" },
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;
