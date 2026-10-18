import { DM_Serif_Display, Inter } from "next/font/google";

export const serif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
});

export const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const brandFontVariables = `${serif.variable} ${sans.variable}`;
