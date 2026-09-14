export function isCurrentPath(pathname: string, href: string, rootHref: string): boolean {
  return href === rootHref ? pathname === rootHref : pathname.startsWith(href);
}
