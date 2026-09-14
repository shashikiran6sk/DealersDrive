import { Plate } from '@/components/ui/primitives';
import { countLabel } from '@/lib/plural';
import { stateCode } from '@/lib/state-codes';

import { DISTRICT_PICKER_TEXT } from './district-picker.constants';
import type { StateGroup } from './district-picker.types';
import { dealersIn } from './utils';

export function StateHeading({ group }: { group: StateGroup }) {
  const code = stateCode(group.state);

  return (
    <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px] border-b border-(--color-divider) pb-[7px]">
      {code ? <Plate>{code}</Plate> : null}
      <h3
        id={`state-${group.key}`}
        className="font-heading text-[14px] font-semibold uppercase tracking-[0.04em]"
      >
        {group.state ?? DISTRICT_PICKER_TEXT.unknownState}
      </h3>
      <span className="text-[11px] ink-faint tnum">
        {countLabel(group.districts.length, 'district')}
      </span>
      <span className="ml-auto text-[11px] ink-subtle tnum">
        {countLabel(dealersIn(group), 'dealership')}
      </span>
    </div>
  );
}
