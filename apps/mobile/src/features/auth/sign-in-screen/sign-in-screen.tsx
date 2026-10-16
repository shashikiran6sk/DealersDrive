import { useQuery } from '@tanstack/react-query';
import { CustomerSignUpInput, type NativeOtpChallenge } from '@dealers-drive/contracts/native-auth';
import { IndianMobile, normaliseIndianMobile } from '@dealers-drive/contracts/common';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '../../../components/action-button';
import { AuthField } from '../../../components/auth-field';
import { PolicyChoice } from '../../../components/policy-choice';
import { Page } from '../../../components/page';
import { ApiError } from '../../../services/api';
import { colors, spacing, typography } from '../../../theme/tokens';
import { useAuth } from '../auth-provider';
import { AUTH_TEXT } from '../auth.constants';

export function SignInScreen() {
  const { api, manager } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const [phase, setPhase] = useState<'phone' | 'otp' | 'name' | 'reactivate'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [challenge, setChallenge] = useState<NativeOtpChallenge | null>(null);
  const [ticket, setTicket] = useState<{
    token: string;
    expiresAt: string;
    phoneDisplay: string;
  } | null>(null);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [retryAt, setRetryAt] = useState(0);
  const locked = useRef(false);
  const generation = useRef<number | null>(null);
  const completed = useRef(false);
  const controller = useRef(new AbortController());
  const publication = useQuery({
    queryKey: ['legal-publication'],
    queryFn: ({ signal }) => api.publication(signal),
  });
  useEffect(() => {
    generation.current = manager.beginAuthentication();
    controller.current = new AbortController();
    return () => {
      controller.current.abort();
      if (!completed.current && generation.current !== null)
        manager.cancelAuthentication(generation.current);
    };
  }, [manager]);
  useEffect(() => {
    if (phase !== 'otp') return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  const policyVersion = publication.data
    ? `${String(publication.data.collectionEnabled)}|${publication.data.documents.map((document) => `${document.version}:${document.digest}`).join('|')}`
    : undefined;
  useEffect(() => {
    setTerms(false);
    setPrivacy(false);
  }, [policyVersion]);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        if (!completed.current) {
          controller.current.abort();
          if (generation.current !== null) manager.cancelAuthentication(generation.current);
        }
      }),
    [navigation, manager],
  );
  const finish = async (
    credential: Parameters<typeof manager.accept>[1],
    customer: Parameters<typeof manager.accept>[2],
  ) => {
    const active = generation.current;
    if (active === null || controller.current.signal.aborted) return;
    if (await manager.accept(active, credential, customer)) {
      completed.current = true;
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }
  };
  const execute = async (work: (signal: AbortSignal) => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await work(controller.current.signal);
    } catch (failure) {
      if (controller.current.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : AUTH_TEXT.restoreError);
      if (failure instanceof ApiError) {
        if (failure.retryAfterSeconds) setRetryAt(Date.now() + failure.retryAfterSeconds * 1000);
        if (
          ['NATIVE_OTP_EXPIRED', 'SIGN_UP_EXPIRED', 'CUSTOMER_REACTIVATION_EXPIRED'].includes(
            failure.code,
          )
        ) {
          setPhase('phone');
          setChallenge(null);
          setTicket(null);
          setOtp('');
        }
        if (['AGREEMENT_VERSION_CHANGED', 'PRIVACY_VERSION_CHANGED'].includes(failure.code)) {
          setTerms(false);
          setPrivacy(false);
          await publication.refetch();
        }
      }
    } finally {
      locked.current = false;
      if (!controller.current.signal.aborted) setBusy(false);
    }
  };
  const send = () =>
    execute(async (signal) => {
      if (!IndianMobile.safeParse(phone).success) {
        setError(AUTH_TEXT.invalidPhone);
        return;
      }
      const result = await api.request(phone, signal);
      if (signal.aborted) return;
      setChallenge(result);
      setRetryAt(Date.parse(result.retryAt));
      setOtp('');
      setPhase('otp');
    });
  const verify = () =>
    execute(async (signal) => {
      if (!challenge || !/^\d{4,8}$/.test(otp)) {
        setError(AUTH_TEXT.invalidCode);
        return;
      }
      if (Date.parse(challenge.expiresAt) <= Date.now()) {
        setError(AUTH_TEXT.expired);
        setPhase('phone');
        return;
      }
      const result = await api.verify(challenge.challenge, otp, signal);
      if (signal.aborted) return;
      if (result.status === 'SIGNED_IN') await finish(result.credential, result.customer);
      else if (result.status === 'NAME_REQUIRED') {
        setTicket({
          token: result.signUpToken,
          expiresAt: result.expiresAt,
          phoneDisplay: result.phoneDisplay,
        });
        setPhase('name');
      } else {
        setTicket({
          token: result.reactivationToken,
          expiresAt: result.expiresAt,
          phoneDisplay: result.phoneDisplay,
        });
        setPhase('reactivate');
      }
    });
  const reactivate = () =>
    execute(async (signal) => {
      if (!ticket || Date.parse(ticket.expiresAt) <= Date.now()) {
        setError(AUTH_TEXT.expired);
        setPhase('phone');
        setTicket(null);
        return;
      }
      const result = await api.reactivate(ticket.token, signal);
      if (!signal.aborted) await finish(result.credential, result.customer);
    });
  const signUp = () =>
    execute(async (signal) => {
      if (!ticket || Date.parse(ticket.expiresAt) <= Date.now()) {
        setError(AUTH_TEXT.expired);
        setPhase('phone');
        return;
      }
      const current = publication.data;
      if (!current || current.state === 'UNAVAILABLE') {
        setError(AUTH_TEXT.unavailablePolicy);
        return;
      }
      if (current.collectionEnabled && (!terms || !privacy)) {
        setError(AUTH_TEXT.agreements);
        return;
      }
      const termsDocument = current.documents.find((document) => document.id === 'terms');
      const privacyDocument = current.documents.find((document) => document.id === 'privacy');
      const parsed = CustomerSignUpInput.safeParse({
        signUpToken: ticket.token,
        fullName: name,
        ...(current.collectionEnabled
          ? {
              agreement: {
                version: termsDocument?.version,
                accepted: true,
                privacyAcknowledged: true,
                privacyVersion: privacyDocument?.version,
              },
            }
          : {}),
      });
      if (!parsed.success) {
        setError(AUTH_TEXT.nameValidation);
        return;
      }
      const result = await api.signUp(parsed.data, signal);
      if (!signal.aborted) await finish(result.credential, result.customer);
    });
  const resend = () =>
    execute(async (signal) => {
      if (!challenge || Date.now() < retryAt) return;
      const result = await api.resend(challenge.challenge, signal);
      if (signal.aborted) return;
      setChallenge(result);
      setRetryAt(Date.parse(result.retryAt));
      setOtp('');
    });
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior="height" style={styles.root}>
        <Page
          title={
            phase === 'phone'
              ? AUTH_TEXT.title
              : phase === 'otp'
                ? AUTH_TEXT.codeTitle
                : phase === 'reactivate'
                  ? AUTH_TEXT.reactivate
                  : AUTH_TEXT.nameTitle
          }
          description={
            phase === 'phone'
              ? AUTH_TEXT.description
              : phase === 'otp'
                ? challenge?.phoneDisplay
                : ticket?.phoneDisplay
          }
        >
          {phase === 'phone' ? (
            <>
              <AuthField
                label={AUTH_TEXT.mobile}
                prefix={AUTH_TEXT.countryCode}
                placeholder={AUTH_TEXT.mobilePlaceholder}
                keyboardType="phone-pad"
                autoComplete="tel-national"
                value={phone}
                onChangeText={(value) => {
                  const normalized = normaliseIndianMobile(value);
                  setPhone(
                    normalized ? normalized.slice(3) : value.replace(/\D/g, '').slice(0, 15),
                  );
                }}
                maxLength={18}
                editable={!busy}
              />
              <ActionButton label={AUTH_TEXT.send} pending={busy} onPress={() => void send()} />
            </>
          ) : null}
          {phase === 'otp' ? (
            <>
              <AuthField
                label={AUTH_TEXT.code}
                placeholder={AUTH_TEXT.codePlaceholder}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 8))}
                maxLength={8}
                editable={!busy}
              />
              <ActionButton label={AUTH_TEXT.verify} pending={busy} onPress={() => void verify()} />
              <ActionButton
                variant="secondary"
                label={remaining ? AUTH_TEXT.resendWait(remaining) : AUTH_TEXT.resend}
                disabled={busy || remaining > 0}
                onPress={() => void resend()}
              />
              <ActionButton
                variant="ghost"
                label={AUTH_TEXT.changeNumber}
                disabled={busy}
                onPress={() => {
                  setPhase('phone');
                  setOtp('');
                  setError(null);
                }}
              />
            </>
          ) : null}
          {phase === 'reactivate' ? (
            <>
              <Text style={styles.text}>{AUTH_TEXT.deactivated}</Text>
              <Text style={styles.text}>{ticket?.phoneDisplay}</Text>
              <ActionButton
                label={AUTH_TEXT.reactivate}
                pending={busy}
                onPress={() => void reactivate()}
              />
            </>
          ) : null}
          {phase === 'name' ? (
            <>
              <AuthField
                label={AUTH_TEXT.name}
                placeholder={AUTH_TEXT.namePlaceholder}
                autoComplete="name"
                autoCapitalize="words"
                autoCorrect={false}
                value={name}
                onChangeText={setName}
                maxLength={80}
                editable={!busy}
              />
              {publication.data?.collectionEnabled ? (
                <View>
                  <PolicyChoice
                    kind="terms"
                    checked={terms}
                    onChange={() => setTerms(!terms)}
                    disabled={busy}
                  />
                  <PolicyChoice
                    kind="privacy"
                    checked={privacy}
                    onChange={() => setPrivacy(!privacy)}
                    disabled={busy}
                  />
                </View>
              ) : null}
              <ActionButton
                label={AUTH_TEXT.create}
                pending={busy}
                disabled={
                  !publication.data ||
                  publication.data.state === 'UNAVAILABLE' ||
                  (publication.data.collectionEnabled && (!terms || !privacy))
                }
                onPress={() => void signUp()}
              />
              {publication.isError ? (
                <ActionButton label={AUTH_TEXT.retry} onPress={() => void publication.refetch()} />
              ) : null}
            </>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {phase !== 'name' ? (
            <View style={styles.links}>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/policy/terms')}
                style={styles.link}
              >
                <Text style={styles.linkText}>{AUTH_TEXT.terms}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/policy/privacy')}
                style={styles.link}
              >
                <Text style={styles.linkText}>{AUTH_TEXT.privacy}</Text>
              </Pressable>
            </View>
          ) : null}
        </Page>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 15, lineHeight: 24 },
  root: { flex: 1, backgroundColor: colors.page },
  error: { fontFamily: typography.family, color: colors.ink, fontSize: typography.body },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  link: { minHeight: 48, justifyContent: 'center' },
  linkText: { fontFamily: typography.family, color: colors.ink, textDecorationLine: 'underline' },
});
