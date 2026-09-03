import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * The `.input` class as a component.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * This is the one component in F009–F013 that is **not** a port. DESIGN-SPEC
 * §2.3 defines the control, and `globals.css` has always carried `.input` —
 * but the baseline has no React wrapper for it, so `className="input"` is
 * written by hand at **70** call sites (audit finding D-B).
 *
 * That is the same failure that produced a 75 % `Button` bypass rate and five
 * hand-rolled `.table` implementations: the CSS existed, the component did
 * not, and everyone reached for the class. Creating it here — before those 70
 * sites are reconstructed — is the point at which that is cheap to prevent
 * rather than expensive to undo.
 *
 * `Input`, `Textarea` and `Select` are three components rather than one
 * polymorphic control because `.input`, `textarea.input` and `select.input`
 * are three different rules in the stylesheet, and because a caller should get
 * the right DOM element's props typed.
 */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('input', className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('input', className)} {...props} />;
}
