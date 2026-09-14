import { Plate } from '@/components/ui/primitives';
import { countLabel } from '@/lib/plural';
import { stateCode } from '@/lib/state-codes';

import { DISTRICT_PICKER_TEXT } from './district-picker.constants';
import type { StateGroup } from './district-picker.types';
import { dealersIn } from './utils';

/**
 * A state, as a heading and nothing else.
 *
 * Deliberately not a `<button>`, not focusable, with no hover, no pressed
 * styling and no cursor change: a state is not a place this product can be
 * filtered to, and anything that looks pressable here would be an invitation to
 * a dead end.
 *
 * The plate carries the RTO code because that is what the code *is* — `TN 09 BX
 * 4412` starts with the same two letters — which stretches §4.5's enumeration of
 * four plate uses by one, on the one motif in the system that means "a
 * registration authority said this".
 */
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
