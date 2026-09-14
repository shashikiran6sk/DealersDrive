# web / components/ui/input

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/ui/input/index.ts`

### `export { Input } from './input'`

The `.input` class as a component (DESIGN-SPEC §2.3).

`Input`, `Textarea` and `Select` are three components rather than one
polymorphic control because `.input`, `textarea.input` and `select.input` are
three different rules in the stylesheet, and because a caller should get the
right DOM element's props typed.

## `apps/web/src/components/ui/input/input.tsx`

### `export function Input({ className, ...props }: ComponentPropsWithRef<'input'>)`

`ComponentPropsWithRef` rather than `InputHTMLAttributes` so a caller can hold
the element (**R37**): `ServiceInput` returns focus to the draft box after
every chip, and in React 19 `ref` is an ordinary prop on a function component.
