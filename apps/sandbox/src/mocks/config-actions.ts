/**
 * A stand-in for `@/features/admin/config-actions`.
 *
 * The same coupling as the other three stubs here (**C-4** in
 * `component-map.md`): `ConfigRow` writes through a Server Action, which needs
 * a Next server, and the sandbox renders with the network off.
 *
 * Deliberately *slow*, like `admin-actions.ts`: saving is one of the states the
 * story exists to show, and an action that resolved instantly would make the
 * pending button impossible to look at.
 */
export interface ConfigResult {
  ok: boolean;
  message?: string;
}

export const configActionStub: {
  delayMs: number;
  result: ConfigResult;
  calls: { key: string; type: string; raw: string }[];
} = {
  delayMs: 700,
  result: { ok: true },
  calls: [],
};

export async function updateConfigAction(
  key: string,
  type: string,
  raw: string,
): Promise<ConfigResult> {
  configActionStub.calls.push({ key, type, raw });
  await new Promise((resolve) => setTimeout(resolve, configActionStub.delayMs));
  return configActionStub.result;
}
