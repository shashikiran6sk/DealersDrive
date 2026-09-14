/**
 * Whether a nav item is the page being viewed.
 *
 * A console root — `/dealer`, `/admin` — must not light up for every page
 * beneath it, so it matches exactly while every other item matches its subtree.
 */
export function isCurrentPath(pathname: string, href: string, rootHref: string): boolean {
  return href === rootHref ? pathname === rootHref : pathname.startsWith(href);
}
