import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../../../components/brand';
import { ActionButton } from '../../../components/action-button';
import { Page } from '../../../components/page';
import { StatusPanel } from '../../../components/status-panel';
import { useAuth } from '../../auth/auth-provider';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { colors, typography } from '../../../theme/tokens';
import { ENQUIRY_TEXT } from '../enquiries.constants';

export function SharingNoticeScreen() {
  const { api } = useAuth();
  const router = useRouter();
  const query = useQuery({
    queryKey: ['legal-publication'],
    queryFn: ({ signal }) => api.publication(signal),
  });
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Page header={<Brand />} title={ENQUIRY_TEXT.notice}>
        <ActionButton
          variant="ghost"
          label={ENQUIRY_TEXT.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/privacy-controls'))}
        />
        {query.data?.sharing ? (
          <>
            {query.data.state === 'DRAFT' ? (
              <Text style={styles.text}>{AUTH_TEXT.draft}</Text>
            ) : null}
            <Text style={styles.text}>{query.data.sharing.version}</Text>
            <Text style={styles.text}>{query.data.sharing.text}</Text>
          </>
        ) : (
          <StatusPanel
            pending={query.isPending}
            message={query.error?.message ?? AUTH_TEXT.unavailablePolicy}
            retry={() => void query.refetch()}
          />
        )}
        <ActionButton
          label={AUTH_TEXT.privacy}
          onPress={() => router.navigate('/policy/privacy')}
        />
        <ActionButton label={AUTH_TEXT.terms} onPress={() => router.navigate('/policy/terms')} />
      </Page>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  text: { fontFamily: typography.family, fontSize: 15, lineHeight: 26, color: colors.ink },
});
