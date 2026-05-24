import Script from "next/script";
import { GOOGLE_ADS_ID } from "@/lib/gtag";

/**
 * Renders the global Google Ads gtag snippet.
 * Place this in the root layout — it renders nothing if GOOGLE_ADS_ID is unset.
 */
export default function GoogleAdsTag() {
  if (!GOOGLE_ADS_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GOOGLE_ADS_ID}');
      `}</Script>
    </>
  );
}
