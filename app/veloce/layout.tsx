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
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

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

      {/* Meta Pixel — the signal Facebook/Instagram ads run on: it lets us
          retarget visitors, build lookalike audiences from them, and measure
          what the ads actually produce. The account's pixel existed since
          2022 but had not fired since Jan 2023, because it was never
          installed on this site. Only loads when configured. */}
      {META_PIXEL_ID && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window,document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
          {/* The same CTAs Google Ads counts, reported to Meta as standard
              events so ad sets can optimize for them. Deliberately a separate
              listener from the Google one: either platform can be switched
              off without touching the other. */}
          <Script id="meta-pixel-events" strategy="afterInteractive">
            {`
              (function() {
                var EV = { whatsapp: 'Contact', call: 'Contact', maps: 'FindLocation' };
                document.addEventListener('click', function(e) {
                  var t = e.target;
                  while (t && t.nodeType === 1 && !(t.tagName === 'A' && t.dataset && t.dataset.conversion)) {
                    t = t.parentNode;
                  }
                  if (!t || !t.dataset) return;
                  var ev = EV[t.dataset.conversion];
                  if (window.fbq && ev) {
                    window.fbq('track', ev, { content_name: t.dataset.conversion });
                  }
                }, true);
              })();
            `}
          </Script>
          {/* No <noscript> tracking pixel on purpose. Meta's snippet ships
              one, but Next preloads the <img> src even inside <noscript>,
              and that preload is itself a GET to /tr?ev=PageView — so every
              visitor would be counted twice. The fallback only ever covered
              visitors with JavaScript off, who cannot click our CTAs anyway. */}
        </>
      )}
      {children}
    </>
  )
}
