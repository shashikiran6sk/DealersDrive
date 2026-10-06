import type { SupportAssignee } from '@dealers-drive/contracts';
import Link from 'next/link';

import { Input, Select } from '@/components/ui/input';

import {
  SUPPORT_CATEGORY_FILTERS,
  SUPPORT_PRIORITY_FILTERS,
  SUPPORT_QUEUE_TEXT,
} from './support-queue.constants';
import type { SupportQueueFilters as Filters } from './support-queue.types';
import { isQueueFiltered, supportQueueHref } from './utils';
import { LinkPendingLabel } from '@/components/ui/link-pending';

const LABEL = 'flex flex-col gap-[4px] text-[11px] uppercase tracking-[0.08em] ink-subtle';
const CONTROL = 'text-[13px] normal-case tracking-normal';

export function SupportQueueFilters({
  filters,
  assignees,
}: {
  filters: Filters;
  assignees: SupportAssignee[];
}) {
  return (
    <form
      method="get"
      action={supportQueueHref({})}
      role="search"
      aria-label={SUPPORT_QUEUE_TEXT.filtersLabel}
      className="flex flex-wrap items-end gap-[10px]"
    >
      {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}

      <label className={`${LABEL} min-w-[220px] flex-1 sm:max-w-[300px]`}>
        {SUPPORT_QUEUE_TEXT.searchLabel}
        <Input
          name="q"
          type="search"
          defaultValue={filters.q ?? ''}
          placeholder={SUPPORT_QUEUE_TEXT.searchPlaceholder}
          maxLength={120}
          className={CONTROL}
        />
      </label>
      <label className={LABEL}>
        {SUPPORT_QUEUE_TEXT.categoryLabel}
        <Select
          name="category"
          defaultValue={filters.category ?? ''}
          className={`${CONTROL} min-w-[170px]`}
        >
          <option value="">{SUPPORT_QUEUE_TEXT.any}</option>
          {SUPPORT_CATEGORY_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
      <label className={LABEL}>
        {SUPPORT_QUEUE_TEXT.priorityLabel}
        <Select
          name="priority"
          defaultValue={filters.priority ?? ''}
          className={`${CONTROL} min-w-[110px]`}
        >
          <option value="">{SUPPORT_QUEUE_TEXT.any}</option>
          {SUPPORT_PRIORITY_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
      <label className={LABEL}>
        {SUPPORT_QUEUE_TEXT.assigneeLabel}
        <Select
          name="assignee"
          defaultValue={filters.assignee ?? ''}
          className={`${CONTROL} min-w-[160px]`}
        >
          <option value="">{SUPPORT_QUEUE_TEXT.anyone}</option>
          <option value="me">{SUPPORT_QUEUE_TEXT.me}</option>
          <option value="unassigned">{SUPPORT_QUEUE_TEXT.unassigned}</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </Select>
      </label>
      <label className={LABEL}>
        {SUPPORT_QUEUE_TEXT.fromLabel}
        <Input name="from" type="date" defaultValue={filters.from ?? ''} className={CONTROL} />
      </label>
      <label className={LABEL}>
        {SUPPORT_QUEUE_TEXT.toLabel}
        <Input name="to" type="date" defaultValue={filters.to ?? ''} className={CONTROL} />
      </label>

      <button type="submit" className="btn btn-secondary">
        {SUPPORT_QUEUE_TEXT.apply}
      </button>
      {isQueueFiltered(filters) ? (
        <Link
          href={supportQueueHref({ status: filters.status })}
          className="relative btn btn-ghost text-[12px]"
        >
          <LinkPendingLabel>{SUPPORT_QUEUE_TEXT.clear}</LinkPendingLabel>
        </Link>
      ) : null}
    </form>
  );
}
