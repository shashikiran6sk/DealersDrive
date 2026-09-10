import { describe, expect, it } from 'vitest';

import { OnboardingInput } from '../../src/auth.js';
import { UpdateDealerInput } from '../../src/dealer.js';

/**
 * R30 — what a dealer is told when a bound refuses them.
 *
 * Zod's own message for a bound with no message is written for the person who
 * wrote the schema: `Too big: expected array to have <=12 items`. It reached a
 * dealer, under the *Services you offer* box on the profile screen, and it is
 * wrong in every way a message can be wrong for that reader — they did not type
 * an array, "items" is not a word the screen has used, and nothing in it says
 * what to do next.
 *
 * These strings are rendered verbatim: `saveDealerProfileAction` flattens
 * `error.issues` onto the input names and `Field` prints the message under the
 * box, and the API's own 400 arrives through the same path. So the schema is
 * where the wording lives, and this is where it is held.
 *
 * ## Why the assertion is a *shape* and not a list of sentences
 *
 * Pinning the exact copy would make this a test that fails whenever somebody
 * improves the wording, which teaches people to update the test without reading
 * it. What is asserted instead is the property that was actually broken: **no
 * message a dealer can reach is Zod's default**. A new bound added without a
 * message fails here, which is the case that produced the bug.
 */

/** Zod's own vocabulary. None of it belongs in front of a dealer. */
const MACHINE_WORDS = [
  'expected',
  'received',
  'invalid_',
  'too_big',
  'too_small',
  'array',
  'string to have',
  'items',
  'element',
];

function messagesFor(result: { error?: { issues: readonly { message: string }[] } }): string[] {
  return (result.error?.issues ?? []).map((issue) => issue.message);
}

function expectHuman(messages: string[]): void {
  expect(messages.length).toBeGreaterThan(0);
  for (const message of messages) {
    const lower = message.toLowerCase();
    for (const word of MACHINE_WORDS) {
      expect(lower, `"${message}" reads like a schema, not like a sentence`).not.toContain(word);
    }
    // A sentence, not a fragment: something a dealer can read and act on.
    expect(message).toMatch(/[.!]$/);
  }
}

/** A wizard that would otherwise be accepted, so the only issue is the one under test. */
const ONBOARDING = {
  fullName: 'R. Sundaram',
  phone: '9840012345',
  legalName: 'Sri Lakshmi Motors',
  addressLine: '14 Katpadi Road',
  city: 'Vellore',
  district: 'Vellore',
  state: 'Tamil Nadu',
  pincode: '632001',
  mapsUrl: 'https://maps.app.goo.gl/abcdef123456',
  tagline: 'Hatchbacks under six lakh, every one inspected in-house.',
  specialities: ['Hatchbacks'],
};

describe('the service list says what is wrong in the dealer’s own words', () => {
  /** The reported bug, on the screen it was reported from. */
  it('answers a thirteenth service without mentioning arrays or items', () => {
    const services = Array.from({ length: 13 }, (_, index) => `Service ${index + 1}`);

    expectHuman(messagesFor(UpdateDealerInput.safeParse({ specialities: services })));
    expectHuman(messagesFor(OnboardingInput.safeParse({ ...ONBOARDING, specialities: services })));
  });

  it('answers an emptied list', () => {
    expectHuman(messagesFor(UpdateDealerInput.safeParse({ specialities: [] })));
    expectHuman(messagesFor(OnboardingInput.safeParse({ ...ONBOARDING, specialities: [] })));
  });

  it('answers a service typed as a paragraph', () => {
    const services = ['Hatchbacks', 'x'.repeat(61)];

    expectHuman(messagesFor(UpdateDealerInput.safeParse({ specialities: services })));
    expectHuman(messagesFor(OnboardingInput.safeParse({ ...ONBOARDING, specialities: services })));
  });
});

describe('the tagline says what is wrong in the dealer’s own words', () => {
  it('answers a line too short and a line too long', () => {
    expectHuman(messagesFor(UpdateDealerInput.safeParse({ tagline: 'Cars' })));
    expectHuman(messagesFor(UpdateDealerInput.safeParse({ tagline: 'x'.repeat(201) })));
    expectHuman(messagesFor(OnboardingInput.safeParse({ ...ONBOARDING, tagline: 'Cars' })));
  });
});

/**
 * The two schemas are the same field on two screens — the sign-up wizard
 * validates against `OnboardingInput` and the profile screen against
 * `UpdateDealerInput`. A message on one side and a default on the other is one
 * field answering a dealer in two voices depending on where they were standing.
 */
describe('the two schemas answer identically', () => {
  it('gives the same sentence for the same mistake', () => {
    const services = Array.from({ length: 13 }, (_, index) => `Service ${index + 1}`);

    expect(messagesFor(UpdateDealerInput.safeParse({ specialities: services }))).toEqual(
      messagesFor(OnboardingInput.safeParse({ ...ONBOARDING, specialities: services })),
    );
    expect(messagesFor(UpdateDealerInput.safeParse({ tagline: 'Cars' }))).toEqual(
      messagesFor(OnboardingInput.safeParse({ ...ONBOARDING, tagline: 'Cars' })),
    );
  });
});
