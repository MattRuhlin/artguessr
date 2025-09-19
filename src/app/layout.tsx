import type { Metadata } from "next";
import { Geist, Geist_Mono, Creepster, Metal_Mania } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const creepster = Creepster({
  variable: "--font-creepster",
  subsets: ["latin"],
  weight: "400",
});

const metalMania = Metal_Mania({
  variable: "--font-metal-mania",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "MetGuessr - Art History Challenge",
  description: "Test your knowledge of art history! Guess where famous artworks were created by clicking on the world map. Get points based on how close you are!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${creepster.variable} ${metalMania.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
