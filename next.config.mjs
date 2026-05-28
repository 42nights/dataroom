/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "pdfjs-dist"],
  turbopack: {},
};

export default nextConfig;
