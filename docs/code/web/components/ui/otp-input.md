# web / components/ui/otp-input

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/ui/otp-input/otp-input.tsx`

### `export function OtpInput(`

DESIGN-SPEC §2.3 — one box per digit, 52×58, 22px tabular (**R39**).

The behaviour people notice only when it is missing: typing moves forward,
Backspace on an empty box moves back and clears the one it lands on, and
pasting six digits into _any_ box fills all six — which is what the "copy
code" affordance on iOS and Android actually produces. `one-time-code` goes on
the first box only, and the paste handler turns that autofill into six digits;
six separate inputs would otherwise forfeit it.

The value is owned by the caller. This renders `value`, split — there is no
second copy of the code living in six pieces of DOM state.

### `const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice`

More than one digit in one box means an autofill or a paste landed here.

### `const target = value[index] ? index : index - 1`

On a filled box, clear it. On an empty one, step back and clear that —

### `const target = value[index] ? index : index - 1`

which is what a person who has just noticed the wrong digit expects.

### `autoComplete={index === 0 ? 'one-time-code' : 'off'}`

Only the first box carries it: a phone offering the code fills the

### `autoComplete={index === 0 ? 'one-time-code' : 'off'}`

field it is on, and `handleInput` spreads the six digits from there.

## `apps/web/src/components/ui/otp-input/otp-input.types.ts`

### `value: string`

The digits typed so far, `''` to `length` characters.

### `onComplete?: (value: string) => void`

Fired once the last box is filled — the design's "verify as you finish".
