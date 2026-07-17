import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Colmado POS",
  description: "Sistema de inventario y punto de venta",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
