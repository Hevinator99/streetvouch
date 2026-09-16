import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StreetVouch — Customer feedback made useful",
  description: "Customer feedback and reputation tools for local businesses.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
