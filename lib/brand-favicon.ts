// Tiny SVG favicons generated as data: URIs, one per tenant — avoids
// shipping a separate .ico per org and lets the browser-tab icon follow
// the brand accent. Studio 360 gets a yellow-accented 360° mark; every
// other tenant falls back to a CIRIS wordmark hex.

export function brandFaviconSvg(
  accent: string | null,
  slug: string | null
): string {
  // Studio 360 — black roundel with "360°" and the yellow arc the
  // brandbook uses on the degree symbol.
  if (slug === "studio-360") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#000"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" font-weight="800" font-size="22" fill="#fff">360</text><circle cx="52" cy="18" r="5" fill="${accent ?? "#FFB500"}"/></svg>`;
    return svgDataUri(svg);
  }

  // Default — stencil 'C' on the brand's accent (or the CIRIS ink tone
  // when no accent is set).
  const fill = accent ?? "#1c1917";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${fill}"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia,serif" font-weight="700" font-size="40" fill="#fff">C</text></svg>`;
  return svgDataUri(svg);
}

function svgDataUri(svg: string): string {
  // encodeURIComponent is safer than base64 here — smaller payload and
  // every modern browser handles it as a favicon source.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
