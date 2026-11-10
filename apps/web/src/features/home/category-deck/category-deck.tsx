import { CategoryCard } from './category-card';
import type { CategoryDeckProps } from './category-deck.types';
import { DECK_HEADING_ID, DECK_TEXT } from './category-deck.constants';
import { DeckStack } from './deck-stack';

export function CategoryDeck({ categories }: CategoryDeckProps) {
  if (categories.length === 0) return null;

  return (
    <section
      aria-labelledby={DECK_HEADING_ID}
      data-home-section="categories"
      className="mx-auto max-w-[1440px] px-4 pt-14 pb-6 sm:px-6 md:pt-20 lg:px-10"
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <h2
          id={DECK_HEADING_ID}
          className="text-[32px] leading-[1.02] tracking-[-0.045em] md:text-[clamp(32px,4vw,56px)]"
        >
          {DECK_TEXT.title}
        </h2>
        <p className="max-w-[44ch] text-[15px] ink-muted">{DECK_TEXT.body}</p>
      </div>
      <DeckStack>
        {categories.map((category, position) => (
          <CategoryCard
            key={category.key}
            category={category}
            position={position}
            total={categories.length}
          />
        ))}
      </DeckStack>
    </section>
  );
}
