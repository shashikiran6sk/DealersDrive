import { permanentRedirect } from 'next/navigation';
export default function LegalRedirect() {
  permanentRedirect('/terms#dealer-agreement');
}
