/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/surat/**': ['./node_modules/@sparticuz/chromium/bin/**/*','./node_modules/docx-preview/dist/docx-preview.min.js','./node_modules/jszip/dist/jszip.min.js'],
  },
};

export default nextConfig;

