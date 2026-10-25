import type { NextConfig } from "next";

  const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the production image ships without
  // node_modules. See frontend/Dockerfile.
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: ["react-multi-date-picker", "react-date-object"],
};

export default nextConfig;
