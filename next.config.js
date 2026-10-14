/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
    // pdfjs-dist must run from node_modules at runtime: its fake worker
    // (pdf.worker.mjs) cannot be bundled into the server chunks on Vercel.
    serverComponentsExternalPackages: ["pdfjs-dist", "tesseract.js"]
  }
};
module.exports = nextConfig;
