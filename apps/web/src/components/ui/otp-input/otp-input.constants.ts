export const OTP_LENGTH = 6;

export const OTP_TEXT = {
  groupLabel: 'Verification code',
  digitLabel: (position: number, length: number) =>
    `Digit ${String(position)} of ${String(length)}`,
} as const;
