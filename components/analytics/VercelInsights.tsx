import Script from "next/script";

/**
 * Vercel Web Analytics (cookieless, no personal data) for durable page-view history.
 * Rendered only on Vercel builds; turn it on in the Vercel dashboard (Project -> Analytics).
 * Written as a plain script tag so the site needs no extra npm dependency.
 */
export default function VercelInsights() {
  if (process.env.VERCEL !== "1") return null;
  return (
    <>
      <Script id="vercel-va" strategy="afterInteractive">
        {`window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };`}
      </Script>
      <Script src="/_vercel/insights/script.js" strategy="afterInteractive" defer />
    </>
  );
}
