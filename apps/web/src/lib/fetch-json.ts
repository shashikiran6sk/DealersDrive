export async function readJson<T>(response: Response): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the fetch boundary is untyped
  return (await response.json()) as T;
}
