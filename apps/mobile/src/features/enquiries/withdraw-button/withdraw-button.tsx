import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
import { ActionButton } from '../../../components/action-button';
import { useAuth } from '../../auth/auth-provider';
import { ApiError } from '../../../services/api';
import { enquiriesApi } from '../enquiries-api';
import { ENQUIRY_TEXT } from '../enquiries.constants';

export function WithdrawButton({
  id,
  grant,
  dealershipScope = grant,
}: {
  id: string;
  grant: boolean;
  dealershipScope?: boolean;
}) {
  const { manager } = useAuth();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = useRef(false);
  const confirm = () => {
    const token = manager.token();
    const owner = manager.getSnapshot().customer?.id;
    if (!token || !owner || locked.current) return;
    Alert.alert(
      ENQUIRY_TEXT.withdrawTitle,
      dealershipScope ? ENQUIRY_TEXT.withdrawBody : ENQUIRY_TEXT.legacyWithdrawBody,
      [
        { text: ENQUIRY_TEXT.cancel, style: 'cancel' },
        {
          text: ENQUIRY_TEXT.withdraw,
          style: 'destructive',
          onPress: () => {
            const run = async () => {
              if (
                locked.current ||
                manager.token() !== token ||
                manager.getSnapshot().customer?.id !== owner
              )
                return;
              locked.current = true;
              setBusy(true);
              setNotice(null);
              try {
                await enquiriesApi.withdraw(token, id, grant);
                if (manager.token() !== token || manager.getSnapshot().customer?.id !== owner)
                  return;
                setNotice(ENQUIRY_TEXT.withdrawn);
                await cache.invalidateQueries({
                  queryKey: ['customer', owner, 'sharing-permissions'],
                });
                await cache.invalidateQueries({ queryKey: ['customer', owner, 'sharing-status'] });
                await cache.invalidateQueries({ queryKey: ['customer', owner, 'enquiries'] });
                await cache.invalidateQueries({ queryKey: ['customer', owner, 'enquiry'] });
                await cache.invalidateQueries({ queryKey: ['customer', owner, 'legal-history'] });
              } catch (error) {
                if (manager.getSnapshot().customer?.id !== owner || manager.token() !== token)
                  return;
                setNotice(error instanceof Error ? error.message : ENQUIRY_TEXT.failed);
                if (error instanceof ApiError && error.status === 401) await manager.invalidate();
              } finally {
                locked.current = false;
                setBusy(false);
              }
            };
            void run();
          },
        },
      ],
    );
  };
  return (
    <>
      <ActionButton
        variant="secondary"
        label={ENQUIRY_TEXT.withdraw}
        pending={busy}
        onPress={confirm}
      />
      {notice ? <Text accessibilityLiveRegion="polite">{notice}</Text> : null}
    </>
  );
}
