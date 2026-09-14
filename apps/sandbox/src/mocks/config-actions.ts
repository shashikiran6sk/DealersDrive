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
