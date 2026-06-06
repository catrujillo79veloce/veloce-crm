import type { Metadata } from "next"
import Script from "next/script"

// ---------------------------------------------------------------------------
// /veloce — Public landing page for Google Ads, Meta Ads, and direct traffic.
//
// Lives outside the (crm) authenticated layout so it has no nav/sidebar and
// loads as fast as possible. Includes optional Google Ads conversion tracking
// when NEXT_PUBLIC_GOOGLE_ADS_ID is configured.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Veloce | Tienda de Bicicletas en El Poblado, Medellín",
  description:
    "Bicicletas premium Orbea, Colnago, Pinarello. Bike Fit Retul 3D, Indoor Cycling, taller especializado. Calle 16A Sur # 32B-38, Local 101, El Poblado, Medellín.",
  keywords: [
    "bicicletas medellin",
    "tienda bicicletas el poblado",
    "orbea medellin",
    "colnago medellin",
    "bike fit retul",
    "indoor cycling medellin",
    "taller bicicletas medellin",
    "veloce cycling",
  ],
  openGraph: {
    title: "Veloce — Tienda de Bicicletas en El Poblado",
    description:
      "Bicicletas premium, Bike Fit Retul 3D, Indoor Cycling. El Poblado, Medellín.",
    type: "website",
    locale: "es_CO",
  },
  robots: {
    index: true,
    follow: true,
  },
}

const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
const WHATSAPP_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_WHATSAPP_LABEL ?? ""
const MAPS_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_MAPS_LABEL ?? ""
const CALL_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_CALL_LABEL ?? ""

export default function VeloceLandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Google Ads / GA4 tag — only loads when configured */}
      {GOOGLE_ADS_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-ads-config" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GOOGLE_ADS_ID}');
            `}
          </Script>
          {/* Conversion-event listener: fires when a CTA marked with
              data-conversion="whatsapp|maps|call" is clicked. Each kind only
              fires if its label env var is set (otherwise it's a no-op). */}
          <Script id="google-ads-conversions" strategy="afterInteractive">
            {`
              (function() {
                var ID = '${GOOGLE_ADS_ID}';
                var L = { whatsapp: '${WHATSAPP_LABEL}', maps: '${MAPS_LABEL}', call: '${CALL_LABEL}' };
                document.addEventListener('click', function(e) {
                  var t = e.target;
                  while (t && t.nodeType === 1 && !(t.tagName === 'A' && t.dataset && t.dataset.conversion)) {
                    t = t.parentNode;
                  }
                  if (!t || !t.dataset) return;
                  var kind = t.dataset.conversion;
                  var label = L[kind];
                  if (window.gtag && label) {
                    window.gtag('event', 'conversion', { send_to: ID + '/' + label });
                  }
                }, true);
              })();
            `}
          </Script>
        </>
      )}
      {children}
    </>
  )
}
