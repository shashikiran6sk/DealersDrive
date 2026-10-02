import { ButtonLink } from '@/components/ui/button';

import { StatusPage } from './status-page';
import { STATUS_LINKS, STATUS_TEXT } from './status-page.constants';

export function NotFoundState() {
  return (
    <StatusPage
      code={STATUS_TEXT.notFound.code}
      title={STATUS_TEXT.notFound.title}
      description={STATUS_TEXT.notFound.description}
      actions={
        <>
          <ButtonLink href={STATUS_LINKS.home} variant="primary" size="lg">
            {STATUS_TEXT.home}
          </ButtonLink>
          <ButtonLink href={STATUS_LINKS.cars} variant="secondary" size="lg">
            {STATUS_TEXT.browseCars}
          </ButtonLink>
        </>
      }
    />
  );
}
