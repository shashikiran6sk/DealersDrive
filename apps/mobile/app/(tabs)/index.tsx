import { useRouter } from 'expo-router';

import { ActionButton } from '../../src/components/action-button';
import { Page } from '../../src/components/page';
import { SHELL_TEXT } from '../../src/features/navigation/navigation.constants';

export default function HomeScreen() {
  const router = useRouter();
  return (
    <Page title={SHELL_TEXT.homeTitle} description={SHELL_TEXT.homeDescription}>
      <ActionButton label={SHELL_TEXT.browse} onPress={() => router.navigate('/explore')} />
    </Page>
  );
}
