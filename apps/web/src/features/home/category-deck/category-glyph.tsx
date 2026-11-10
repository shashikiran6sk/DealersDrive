import type { CategoryIconProps } from './category-deck.types';
import { CATEGORY_ICON_TEXT } from './category-deck.constants';

const WHEEL = 'fill-current';
const HUB = 'fill-white';
const BODY = 'fill-white stroke-current';
const PART = 'origin-center [transform-box:fill-box]';
const CAR = `dd-icon-car ${PART}`;
const SPIN = `dd-icon-wheel ${PART}`;
const KNOB = `dd-icon-knob ${PART}`;
const PRICE = `dd-icon-price ${PART}`;
const NEEDLE = 'dd-icon-needle origin-[32px_27px] [transform-box:view-box] stroke-current';

function Wheel({ cx }: { cx: number }) {
  return (
    <g className={SPIN}>
      <circle cx={cx} cy="24" r="4.5" className={WHEEL} />
      <circle cx={cx} cy="21.6" r="1" className={HUB} />
    </g>
  );
}

export function CategoryGlyph({ icon }: Pick<CategoryIconProps, 'icon'>) {
  switch (icon) {
    case 'suv':
      return (
        <g className={CAR}>
          <path
            d="M5 24V15l6-8h29l8 8h8q3 0 3 3v6Z"
            className={BODY}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <Wheel cx={16} />
          <Wheel cx={48} />
        </g>
      );
    case 'family':
      return (
        <g className={CAR}>
          <path
            d="M3 24V12l4-5h36l9 8h6q3 0 3 3v6Z"
            className={BODY}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M17 8v7M30 8v7" className="stroke-current" strokeWidth="2" />
          <Wheel cx={15} />
          <Wheel cx={50} />
        </g>
      );
    case 'automatic':
      return (
        <>
          <rect
            x="4"
            y="5"
            width="56"
            height="22"
            rx="11"
            className="fill-none stroke-current"
            strokeWidth="2"
          />
          <text
            x="12"
            y="20.5"
            fontSize="10"
            fontWeight="800"
            letterSpacing="3"
            className="fill-current"
          >
            {CATEGORY_ICON_TEXT.gears}
          </text>
          <g className={KNOB}>
            <rect x="40" y="9" width="14" height="14" rx="7" className="fill-current" />
            <text
              x="47"
              y="20"
              textAnchor="middle"
              fontSize="10"
              fontWeight="800"
              className="fill-white"
            >
              {CATEGORY_ICON_TEXT.drive}
            </text>
          </g>
        </>
      );
    case 'price':
      return (
        <text
          x="32"
          y="22"
          textAnchor="middle"
          fontSize="17"
          fontWeight="800"
          letterSpacing="-0.5"
          className={`fill-current ${PRICE}`}
        >
          {CATEGORY_ICON_TEXT.price}
        </text>
      );
    case 'odometer':
      return (
        <>
          <path
            d="M12 27a20 20 0 0 1 40 0"
            className="fill-none stroke-current"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M16 17l3 2M32 8v4M48 17l-3 2"
            className="stroke-current"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M32 27L22 16" className={NEEDLE} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="32" cy="27" r="3" className={WHEEL} />
        </>
      );
  }
}
