/**
 * Reads a JSON body as the shape the caller expects.
 *
 * The single type assertion at the browser's fetch boundary, so the three BFF
 * calls that need one do not each carry their own. `Response.json()` is untyped
 * by construction; where a wrong shape would render as a plausible sentence
 * rather than an obvious break, parse the contract instead — see `apiGetParsed`.
 */
export async function readJson<T>(response: Response): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the fetch boundary is untyped
  return (await response.json()) as T;
}
