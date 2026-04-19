import type { NextConfig } from "next";

const allowedDevOrigins = (process.env.ALLOWED_HOSTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 && { allowedDevOrigins }),
};

export default nextConfig;
