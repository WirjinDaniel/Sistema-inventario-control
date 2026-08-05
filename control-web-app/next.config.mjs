/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ?? "http://localhost:8000";

const nextConfig = {
  async rewrites() {
    return [
      // Con slash final → lo preserva
      {
        source: "/api/:path*/",
        destination: `${BACKEND_URL}/api/:path*/`,
      },
      // Sin slash final → agrega el slash para que Django lo reciba correctamente
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*/`,
      },
    ];
  },
};

export default nextConfig;
