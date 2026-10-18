import { useLocalSearchParams } from 'expo-router';
import { useSession } from '../../auth/auth-provider';
import { EnquiryFormScreen } from '../enquiry-form-screen';

export function EnquiryScreen() {
  const session = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <EnquiryFormScreen key={`${session.status}:${session.customer?.id}:${slug}`} />;
}
