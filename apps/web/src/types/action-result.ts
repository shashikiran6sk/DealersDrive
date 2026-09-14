/**
 * The shape every server action answers a client component with. `AdminResult`
 * and the dealer actions are structurally this plus whatever payload they carry,
 * so a component that only needs to know whether it worked takes this.
 */
export interface ActionResult {
  ok: boolean;
  message?: string;
}
