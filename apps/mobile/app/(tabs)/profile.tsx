import { Page } from '../../src/components/page';
import { SHELL_TEXT } from '../../src/features/navigation/navigation.constants';

export default function ProfileScreen() {
  return <Page title={SHELL_TEXT.profileTitle} description={SHELL_TEXT.profileDescription} />;
}
