import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bloodnet/core", "@bloodnet/data"],
};

export default nextConfig;
