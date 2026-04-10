import type { Metadata } from "next"
import { Inter } from "next/font/google"
import I18nProvider from "@/components/layout/I18nProvider"
import { ToastProvider } from "@/components/ui/Toast"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Veloce CRM",
  description: "CRM para Veloce Indoor Cycling",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans`}>
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
