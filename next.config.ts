import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["jspdf", "jspdf-autotable"],
};

export default nextConfig;
