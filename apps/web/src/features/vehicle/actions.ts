'use server';

import {
  CreateVehicleInput,
  UpdateVehicleInput,
  type DealerVehicle,
} from '@dealers-drive/contracts';
import { redirect } from 'next/navigation';

import { ApiError, apiSend } from '@/lib/api';

import {
  NUMBER_FIELDS,
  STEP_FIELDS,
  VEHICLE_WIZARD_TEXT,
} from './vehicle-wizard/vehicle-wizard.constants';
import type { WizardIntent, WizardState } from './vehicle-wizard/vehicle-wizard.types';
import {
  editPath,
  formField,
  isWizardStep,
  rupeesToPaise,
  stepAfter,
  stepBefore,
  stepOfField,
} from './vehicle-wizard/utils';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function intentOf(formData: FormData): WizardIntent {
  const intent = text(formData, 'intent');
  return intent === 'back' || intent === 'draft' ? intent : 'continue';
}

function issueErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = formField(issue.path.map(String).join('.'));
    if (field) errors[field] ??= issue.message;
  }
  return errors;
}

function apiErrors(error: ApiError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [path, message] of Object.entries(error.fieldErrors())) {
    errors[formField(path)] ??= message;
  }
  return errors;
}

function failure(error: unknown, values: Record<string, string>): WizardState {
  if (error instanceof ApiError) {
    const errors = apiErrors(error);
    return {
      errors,
      values,
      ...(Object.keys(errors).length > 0
        ? {}
        : { message: error.userMessage(VEHICLE_WIZARD_TEXT.notSaved) }),
    };
  }
  return { message: VEHICLE_WIZARD_TEXT.unavailable, values };
}

export async function createVehicleAction(
  _previous: WizardState,
  formData: FormData,
): Promise<WizardState> {
  const values = { registrationNumber: text(formData, 'registrationNumber') };
  const parsed = CreateVehicleInput.safeParse(values);
  if (!parsed.success) return { errors: issueErrors(parsed.error.issues), values };

  let created: DealerVehicle;
  try {
    created = await apiSend<DealerVehicle>('POST', '/v1/dealer/vehicles', parsed.data);
  } catch (error) {
    return failure(error, values);
  }

  redirect(editPath(created.id, 'basics'));
}

function payloadFor(fields: readonly string[], formData: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = text(formData, field).trim();
    if (field === 'priceRupees') {
      payload.pricePaise = rupeesToPaise(raw);
    } else if (field === 'registrationNumber') {
      payload.registrationNumber = raw;
    } else if (NUMBER_FIELDS.has(field)) {
      const digits = raw.replace(/[,\s]/g, '');
      payload[field] = digits === '' ? null : /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
    } else {
      payload[field] = raw === '' ? null : raw;
    }
  }
  return payload;
}

export async function saveVehicleStepAction(
  _previous: WizardState,
  formData: FormData,
): Promise<WizardState> {
  const vehicleId = text(formData, 'vehicleId');
  const step = text(formData, 'step');
  if (!vehicleId || !isWizardStep(step) || step === 'review') {
    return { message: VEHICLE_WIZARD_TEXT.notSaved };
  }

  const intent = intentOf(formData);
  const fields = STEP_FIELDS[step];
  const values = Object.fromEntries(fields.map((field) => [field, text(formData, field)]));

  const payload = payloadFor(fields, formData);
  const unreadable = Object.entries(payload)
    .filter(([, value]) => typeof value === 'number' && Number.isNaN(value))
    .map(([field]) => formField(field));
  if (unreadable.length > 0) {
    return {
      errors: Object.fromEntries(
        unreadable.map((field) => [field, VEHICLE_WIZARD_TEXT.numbersOnly]),
      ),
      values,
    };
  }

  const parsed = UpdateVehicleInput.safeParse(payload);
  if (!parsed.success) return { errors: issueErrors(parsed.error.issues), values };

  let saved: DealerVehicle;
  try {
    saved = await apiSend<DealerVehicle>(
      'PATCH',
      `/v1/dealer/vehicles/${encodeURIComponent(vehicleId)}`,
      parsed.data,
    );
  } catch (error) {
    return failure(error, values);
  }

  if (intent === 'draft') redirect(editPath(saved.id, step, '&saved=1'));
  if (intent === 'back') redirect(editPath(saved.id, stepBefore(step)));

  const blocking = saved.issues.filter((issue) => stepOfField(issue.field) === step);
  if (blocking.length > 0) {
    const errors: Record<string, string> = {};
    for (const issue of blocking) errors[formField(issue.field)] ??= issue.message;
    return { errors, values };
  }

  redirect(editPath(saved.id, stepAfter(step)));
}
