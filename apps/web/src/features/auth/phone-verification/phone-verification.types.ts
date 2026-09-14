import type { PhoneOtpWidget } from '@dealers-drive/contracts';

export type PhoneStage = 'idle' | 'code' | 'failed';

export interface PhoneVerificationProps {
  /** `GET /v1/auth/phone/widget`, or null when the API could not be reached. */
  widget: PhoneOtpWidget | null;
  /** The ten digits currently in the phone box. Owned by the wizard. */
  phone: string;
  /** Shown on the success panel — "…has been linked to R. Manikandan". */
  fullName: string;
  /** The session's answer: is `phone` the number this account proved? */
  verified: boolean;
  /** Called once the API has recorded the number, with it in E.164. */
  onVerified: (phone: string) => void;
  /** The step's forward move, from the success panel. */
  onContinue: () => void;
  /**
   * The wizard's own check on the fields above — a name, a well-formed number —
   * run before a message is sent. Returning false stops the send: an SMS costs
   * money, and a dealer who has mistyped their number would be paying for it to
   * arrive somewhere else.
   */
  onBeforeSend: (form: HTMLFormElement | null) => boolean;
  /**
   * A refusal about the number itself, reported so the step can mark the box.
   * "That mobile number is already registered to another dealership" is about
   * the value in the input, so it belongs under the input with `aria-invalid` on
   * it. The panel shows it too, because the panel is where the press happened.
   */
  onRefused?: (message: string) => void;
  /**
   * Where the panel opens. `idle` in the product, always — this exists so the
   * sandbox can render the states that are otherwise only reachable by sending a
   * real message.
   */
  initialStage?: PhoneStage;
}
