import CookieConsent from "@/components/CookieConsent";
import { ScrollRuntime } from "@/app/scroll-runtime";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ScrollRuntime>
      {children}
      <CookieConsent />
    </ScrollRuntime>
  );
}
