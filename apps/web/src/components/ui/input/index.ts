/**
 * The `.input` class as a component (DESIGN-SPEC §2.3).
 *
 * `Input`, `Textarea` and `Select` are three components rather than one
 * polymorphic control because `.input`, `textarea.input` and `select.input` are
 * three different rules in the stylesheet, and because a caller should get the
 * right DOM element's props typed.
 */
export { Input } from './input';
export { Select } from './select';
export { Textarea } from './textarea';
