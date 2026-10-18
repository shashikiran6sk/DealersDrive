import { Page } from '../../src/components/page';
import { SHELL_TEXT } from '../../src/features/navigation/navigation.constants';

export default function SavedScreen() {
  return <Page title={SHELL_TEXT.savedTitle} description={SHELL_TEXT.savedDescription} />;
}
