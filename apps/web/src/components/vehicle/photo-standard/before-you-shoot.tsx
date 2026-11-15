import { GuideImage } from './guide-image';
import { BEFORE_YOU_SHOOT, PHOTO_STANDARD_TEXT, POSES } from './photo-standard.constants';

export function BeforeYouShoot({ showPoses = true }: { showPoses?: boolean }) {
  return (
    <section className="grid gap-5 md:grid-cols-2" aria-labelledby="before-you-shoot">
      <div className="flex flex-col gap-3">
        <h3 id="before-you-shoot" className="text-[20px]">
          {PHOTO_STANDARD_TEXT.beforeTitle}
        </h3>
        {BEFORE_YOU_SHOOT.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <h4 className="text-[14px] font-semibold">{group.title}</h4>
            <ul className="flex flex-col gap-[5px] text-[13px] ink-body">
              {group.items.map(([lead, rest]) => (
                <li key={lead} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-[5px] h-[9px] w-[9px] flex-none rounded-full border-2 border-(--color-focus)"
                  />
                  <span>
                    <strong className="font-semibold text-(--color-ink)">{lead}</strong> {rest}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {showPoses ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-[14px] font-semibold">{PHOTO_STANDARD_TEXT.posesTitle}</h4>
          <p className="text-[13px] ink-body">{PHOTO_STANDARD_TEXT.posesIntro}</p>
          <ul className="grid grid-cols-2 gap-2">
            {POSES.map((pose) => (
              <li
                key={pose.pose}
                className="flex flex-col overflow-hidden rounded-[12px] border border-(--color-divider)"
              >
                <GuideImage
                  src={pose.image}
                  alt={PHOTO_STANDARD_TEXT.poseAlt(pose.title)}
                  className="aspect-[4/5] rounded-none"
                />
                <span className="p-[8px]">
                  <span className="block text-[13px] font-semibold">{pose.title}</span>
                  <span className="block text-[11px] ink-muted">{pose.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] ink-muted">{PHOTO_STANDARD_TEXT.posesNote}</p>
        </div>
      ) : null}
    </section>
  );
}
