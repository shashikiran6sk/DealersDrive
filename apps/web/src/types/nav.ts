/** One entry in a console sidebar or tab bar. Shared by the dealer and admin navs. */
export interface NavItem {
  href: string;
  label: string;
  /** Shown in the bottom tab bar; items without one are desktop-only. */
  short?: string;
}
