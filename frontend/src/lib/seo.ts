import { useEffect } from 'react'

const DEFAULT_TITLE = 'FutureAuth — Passwordless Magic Link & OTP Auth for Rust / Axum'
const DEFAULT_DESCRIPTION =
  'FutureAuth adds magic link and OTP (email + SMS) passwordless authentication to any Rust or Axum app. Users and sessions live in your own Postgres. Install with cargo add futureauth.'
const SITE_ORIGIN = 'https://future-auth.com'

function setMeta(selector: string, attr: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    const [name, key] = selector.replace(/[[\]"]/g, '').split('=')
    el.setAttribute(name, key)
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export interface PageSEO {
  /** Full <title>. If omitted, uses "{pageTitle} — FutureAuth". */
  title?: string
  /** Short title; composed as "{pageTitle} — FutureAuth". */
  pageTitle?: string
  /** Meta description. Defaults to the site description. */
  description?: string
  /** Path portion of the canonical URL (e.g. "/docs"). Defaults to current pathname. */
  canonicalPath?: string
  /** When true, emits robots=noindex,nofollow. Use for authenticated / app pages. */
  noindex?: boolean
}

/**
 * Updates document.title and key meta tags for a page. Safe to call from any
 * component; effect only runs when values change.
 */
export function usePageSEO(seo: PageSEO) {
  const {
    title,
    pageTitle,
    description = DEFAULT_DESCRIPTION,
    canonicalPath,
    noindex = false,
  } = seo

  const resolvedTitle =
    title ?? (pageTitle ? `${pageTitle} — FutureAuth` : DEFAULT_TITLE)

  useEffect(() => {
    document.title = resolvedTitle

    setMeta('meta[name="description"]', 'content', description)
    setMeta('meta[property="og:title"]', 'content', resolvedTitle)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[name="twitter:title"]', 'content', resolvedTitle)
    setMeta('meta[name="twitter:description"]', 'content', description)

    const path = canonicalPath ?? window.location.pathname
    const canonical = `${SITE_ORIGIN}${path === '/' ? '/' : path.replace(/\/$/, '')}`
    setLink('canonical', canonical)
    setMeta('meta[property="og:url"]', 'content', canonical)

    setMeta(
      'meta[name="robots"]',
      'content',
      noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1',
    )
  }, [resolvedTitle, description, canonicalPath, noindex])
}
