'use client';

import {
  ENQUIRY_RELATED_CATEGORIES,
  SupportTicketCategory,
  type SupportTicketCategory as Category,
} from '@dealers-drive/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { createSupportRequestAction } from '@/features/support/support-actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';
import {
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_FORM_TEXT,
  SUPPORT_LIMITS,
  SUPPORT_REQUESTS_PATH,
  supportLoginHref,
} from './support-requests.constants';
import type { SupportRequestFormProps } from './support-requests.types';
import { supportRequestHref } from './utils';

export function SupportRequestForm({
  enquiries,
  initialCategory,
  initialEnquiryId,
  submit = createSupportRequestAction,
}: SupportRequestFormProps) {
  const id = useId();
  const router = useRouter();
  const [category, setCategory] = useState<Category | ''>(initialCategory ?? '');
  const [enquiryId, setEnquiryId] = useState(initialEnquiryId ?? '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useNavigationSafeAction();
  const inFlight = useRef(false);

  const asksForEnquiry = category !== '' && ENQUIRY_RELATED_CATEGORIES.includes(category);
  const fieldId = (name: string) => `${id}-${name}`;

  return (
    <form
      noValidate
      aria-labelledby={`${id}-heading`}
      className="card flex flex-col gap-[16px] bg-white p-[18px] sm:p-[24px]"
      onSubmit={(event) => {
        event.preventDefault();
        if (inFlight.current) return;
        inFlight.current = true;
        setMessage(null);
        startTransition(async () => {
          const result = await submit({
            category,
            subject,
            description,
            ...(asksForEnquiry && enquiryId ? { enquiryId } : {}),
          });
          if (result.status === 'created') {
            router.push(supportRequestHref(result.id));
            return;
          }
          inFlight.current = false;
          if (result.status === 'signed-out') {
            router.push(supportLoginHref(`${SUPPORT_REQUESTS_PATH}/new`));
            return;
          }
          if (result.status === 'invalid') {
            setErrors(result.fieldErrors);
            setMessage(result.message);
            return;
          }
          setErrors({});
          setMessage(result.message);
        });
      }}
    >
      <h2 id={`${id}-heading`} className="sr-only">
        {SUPPORT_FORM_TEXT.title}
      </h2>

      <Field id={fieldId('category')} label={SUPPORT_FORM_TEXT.category} error={errors.category}>
        <Select
          id={fieldId('category')}
          name="category"
          required
          value={category}
          onChange={(event) => {
            const parsed = SupportTicketCategory.safeParse(event.target.value);
            setCategory(parsed.success ? parsed.data : '');
          }}
          {...invalidProps(fieldId('category'), errors.category)}
        >
          <option value="" disabled>
            {SUPPORT_FORM_TEXT.categoryPlaceholder}
          </option>
          {SUPPORT_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      {asksForEnquiry ? (
        <Field
          id={fieldId('enquiry')}
          label={SUPPORT_FORM_TEXT.enquiry}
          hint={SUPPORT_FORM_TEXT.enquiryHint}
          error={errors.enquiryId}
        >
          {enquiries.length === 0 ? (
            <p id={fieldId('enquiry')} className="text-[13px] ink-muted">
              {SUPPORT_FORM_TEXT.noEnquiries}
            </p>
          ) : (
            <Select
              id={fieldId('enquiry')}
              name="enquiryId"
              value={enquiryId}
              onChange={(event) => {
                setEnquiryId(event.target.value);
              }}
              {...invalidProps(fieldId('enquiry'), errors.enquiryId)}
            >
              <option value="">{SUPPORT_FORM_TEXT.noEnquiry}</option>
              {enquiries.map((enquiry) => (
                <option key={enquiry.id} value={enquiry.id}>
                  {SUPPORT_FORM_TEXT.enquiryOption(
                    enquiry.vehicle.title,
                    enquiry.dealerName,
                    enquiry.createdLabel,
                  )}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}

      <Field id={fieldId('subject')} label={SUPPORT_FORM_TEXT.subject} error={errors.subject}>
        <Input
          id={fieldId('subject')}
          name="subject"
          required
          maxLength={SUPPORT_LIMITS.subject}
          placeholder={SUPPORT_FORM_TEXT.subjectPlaceholder}
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
          }}
          {...invalidProps(fieldId('subject'), errors.subject)}
        />
      </Field>

      <Field
        id={fieldId('description')}
        label={SUPPORT_FORM_TEXT.description}
        error={errors.description}
      >
        <Textarea
          id={fieldId('description')}
          name="description"
          required
          rows={7}
          maxLength={SUPPORT_LIMITS.description}
          placeholder={SUPPORT_FORM_TEXT.descriptionPlaceholder}
          className="min-h-[160px] py-[8px]"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          {...invalidProps(fieldId('description'), errors.description)}
        />
        <div className="mt-[4px] text-right text-[11px] ink-subtle tnum" aria-hidden="true">
          {SUPPORT_FORM_TEXT.count(description.length, SUPPORT_LIMITS.description)}
        </div>
      </Field>

      <p className="text-[12px] ink-muted">{SUPPORT_FORM_TEXT.privacy}</p>

      {message ? (
        <p role="alert" className="m-0 text-[13px] text-(--color-err)">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-[10px]">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={pending}
          className="max-sm:w-full"
        >
          {SUPPORT_FORM_TEXT.submit}
        </Button>
        <Link href={SUPPORT_REQUESTS_PATH} className="relative btn btn-ghost max-sm:w-full">
          <LinkPendingLabel>{SUPPORT_FORM_TEXT.cancel}</LinkPendingLabel>
        </Link>
      </div>
      {pending ? (
        <span role="status" className="sr-only">
          {SUPPORT_FORM_TEXT.sending}
        </span>
      ) : null}
    </form>
  );
}
