import { Page } from '../../src/components/page';
import { SHELL_TEXT } from '../../src/features/navigation/navigation.constants';

export default function ExploreScreen() {
  return <Page title={SHELL_TEXT.exploreTitle} description={SHELL_TEXT.exploreDescription} />;
}
