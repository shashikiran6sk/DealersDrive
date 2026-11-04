import { Sequence } from 'remotion';

import type { SceneSlot, Slot } from '../../lib/timeline';
import type { ReelProps } from '../../reel/reel.types';
import { CarScene } from '../car-scene';
import { ClosingScene } from '../closing-scene';
import { OpeningScene } from '../opening-scene';
import { ServicesScene } from '../services-scene';
import { StockScene } from '../stock-scene';

export type SceneProps = {
  slot: SceneSlot;
  props: ReelProps;
  cars: Slot[];
};

export function Scene({ slot, props, cars }: SceneProps) {
  switch (slot.name) {
    case 'opening':
      return <OpeningScene dealer={props.dealer} duration={slot.duration} />;
    case 'services':
      return <ServicesScene dealer={props.dealer} duration={slot.duration} />;
    case 'cars':
      return (
        <>
          {props.featured.map((car, index) => {
            const carSlot = cars[index];
            if (carSlot === undefined) return null;
            return (
              <Sequence
                key={car.slug}
                from={carSlot.from}
                durationInFrames={carSlot.duration}
                name={car.title}
              >
                <CarScene
                  car={car}
                  position={index + 1}
                  total={props.featured.length}
                  duration={carSlot.duration}
                />
              </Sequence>
            );
          })}
        </>
      );
    case 'stock':
      return (
        <StockScene
          gallery={props.gallery}
          stock={props.stock}
          priceRange={props.priceRange}
          duration={slot.duration}
        />
      );
    case 'closing':
      return <ClosingScene dealer={props.dealer} pageUrl={props.pageUrl} asOf={props.asOf} />;
  }
}
