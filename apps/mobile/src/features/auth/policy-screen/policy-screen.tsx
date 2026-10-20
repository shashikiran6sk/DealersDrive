import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '../../../components/action-button';
import { Page } from '../../../components/page';
import { colors, spacing, typography } from '../../../theme/tokens';
import { useAuth } from '../auth-provider';
import { AUTH_TEXT } from '../auth.constants';
import { publicEnvironment } from '../../../services/environment';

export function PolicyScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const { api } = useAuth();
  const publication = useQuery({
    queryKey: ['legal-publication'],
    queryFn: ({ signal }) => api.publication(signal),
  });
  const document = publication.data?.documents.find((entry) => entry.id === documentId);
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Page
        showTitle={false}
        title={documentId === 'privacy' ? AUTH_TEXT.privacy : AUTH_TEXT.terms}
      >
        {publication.isPending ? (
          <Text accessibilityLiveRegion="polite" style={styles.text}>
            {AUTH_TEXT.restoring}
          </Text>
        ) : null}
        {document ? (
          <>
            <Text style={styles.text}>{document.version}</Text>
            {publication.data?.state === 'DRAFT' ? (
              <Text accessibilityRole="alert" style={styles.text}>
                {AUTH_TEXT.draft}
              </Text>
            ) : null}
            {document.sections.map((section) => (
              <View key={section.id} style={styles.section}>
                <Text accessibilityRole="header" style={styles.heading}>
                  {section.heading}
                </Text>
                {section.paragraphs.map((paragraph, index) => (
                  <Text key={`${section.id}-${index}`} style={styles.text}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
          </>
        ) : !publication.isPending ? (
          <>
            <Text accessibilityRole="alert" style={styles.text}>
              {AUTH_TEXT.unavailablePolicy}
            </Text>
            <ActionButton label={AUTH_TEXT.retry} onPress={() => void publication.refetch()} />
            {documentId === 'terms' || documentId === 'privacy' ? (
              <ActionButton
                label={documentId === 'terms' ? AUTH_TEXT.terms : AUTH_TEXT.privacy}
                onPress={() =>
                  void Linking.openURL(
                    new URL(`/${documentId}`, publicEnvironment().webBaseUrl).href,
                  ).catch(() =>
                    Alert.alert(
                      'Unable to open policy',
                      'Please try again or read the policy here when the connection returns.',
                    ),
                  )
                }
              />
            ) : null}
          </>
        ) : null}
      </Page>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  section: { gap: spacing.sm },
  heading: { fontFamily: typography.family, color: colors.ink, fontWeight: '700', fontSize: 18 },
  text: {
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: 24,
  },
});
