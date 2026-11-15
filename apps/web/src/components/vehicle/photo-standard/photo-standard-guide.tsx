import { BeforeYouShoot } from './before-you-shoot';
import { GuideDownloadLink } from './guide-download-link';
import { GuideWalkround } from './guide-walkround';
import { SHOT_GUIDES } from './photo-standard.constants';
import { QuickReference } from './quick-reference';
import { ShotGuideCard } from './shot-guide-card';

export function PhotoStandardGuide() {
  return (
    <div className="flex flex-col gap-[24px]">
      <div className="flex flex-col gap-3">
        <GuideWalkround />
        <GuideDownloadLink variant="primary" />
      </div>
      <BeforeYouShoot />
      <div className="flex flex-col gap-[14px]">
        {SHOT_GUIDES.map((shot) => (
          <ShotGuideCard key={shot.slot} shot={shot} />
        ))}
      </div>
      <QuickReference />
    </div>
  );
}
