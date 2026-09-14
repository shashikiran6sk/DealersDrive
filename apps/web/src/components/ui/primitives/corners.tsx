/**
 * The four registration marks on their own, for the places where the blueprint
 * frame has to be an element `Blueprint` cannot render — the gallery's main
 * image is a `<button>`. Anything carrying `.blueprint` must carry these.
 */
export function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}
