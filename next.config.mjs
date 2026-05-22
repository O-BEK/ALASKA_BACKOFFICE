/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist", "@react-pdf/renderer"],
  },
}

export default nextConfig
