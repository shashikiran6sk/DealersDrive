import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { Page } from '../../../components/page';
import { StatusPanel } from '../../../components/status-panel';
import { colors, typography } from '../../../theme/tokens';
import { dealersApi } from '../../dealers/dealers-api';
import { SUPPORT_TEXT } from '../support.constants';

export function SupportScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const config = useQuery({
    queryKey: ['public', 'config'],
    queryFn: ({ signal }) => dealersApi.config(signal),
  });
  const contact = config.data?.support;
  const open = (href: string) =>
    void Linking.openURL(href).catch(() => setError(SUPPORT_TEXT.contactFailed));
  const whatsapp =
    contact?.whatsappHref && /^https:\/\/(?:wa\.me|api\.whatsapp\.com)\//.test(contact.whatsappHref)
      ? contact.whatsappHref
      : null;
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Page showTitle={false} title={SUPPORT_TEXT.title} description={SUPPORT_TEXT.intro}>
        <ActionButton
          label={SUPPORT_TEXT.create}
          onPress={() => router.navigate('/support-requests/new')}
        />
        <ActionButton
          variant="secondary"
          label={SUPPORT_TEXT.requests}
          onPress={() => router.navigate('/support-requests')}
        />
        {contact ? (
          <>
            {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.customer.email) ? (
              <ActionButton
                variant="secondary"
                label={SUPPORT_TEXT.email}
                onPress={() => open(`mailto:${contact.customer.email}`)}
              />
            ) : null}
            {/^\+?[\d ()-]{7,24}$/.test(contact.customer.phone) ? (
              <ActionButton
                variant="secondary"
                label={SUPPORT_TEXT.phone}
                onPress={() => open(`tel:${contact.customer.phone.replace(/[ ()-]/g, '')}`)}
              />
            ) : null}
            {whatsapp ? (
              <ActionButton
                variant="secondary"
                label={SUPPORT_TEXT.whatsapp}
                onPress={() => open(whatsapp)}
              />
            ) : null}
          </>
        ) : (
          <StatusPanel
            message={config.error?.message ?? SUPPORT_TEXT.loading}
            pending={config.isPending}
            retry={() => void config.refetch()}
          />
        )}
        {error ? (
          <Text accessibilityRole="alert" style={styles.text}>
            {error}
          </Text>
        ) : null}
      </Page>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  text: { fontFamily: typography.family, color: colors.error, fontSize: 15 },
});
