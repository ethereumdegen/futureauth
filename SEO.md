# SEO — Manual Follow-ups

Things that still need to be done by hand after the in-repo SEO pass.

1. **Replace `og-image.svg` with a 1200×630 PNG.** Most platforms render SVG OG
   images, but Twitter/X and LinkedIn previews are more reliable with PNG/JPEG.
   Export the SVG to PNG and update `og:image` + `twitter:image` in
   `frontend/index.html` (and in `frontend/src/lib/seo.ts` if you add per-page
   images).

2. **Submit the sitemap** in Google Search Console and Bing Webmaster Tools:
   `https://future-auth.com/sitemap.xml`.

3. **Verify the domain** in Search Console to get indexing + Core Web Vitals
   reports.

4. **Add a `/blog` or changelog long-term.** Software SEO is largely won with
   content targeting queries like "rust axum auth example" or "rust
   passwordless login tutorial". Each post = another landing page.

5. **Get backlinks:**
   - crates.io (already have)
   - awesome-rust lists
   - r/rust show-offs
   - dev.to cross-posts
   - shields.io badge in the SDK README linking back to `future-auth.com`

6. **Prerender (optional, bigger change).** Because the dashboard is an SPA,
   the `<noscript>` fallback is all that non-JS crawlers see. Google renders
   JS so you're fine there, but consider `vite-plugin-prerender` or a simple
   static-HTML snapshot for `/` and `/docs` if Bing / Twitter / Slack previews
   matter.
