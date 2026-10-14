import { permanentRedirect } from 'next/navigation';
export default function LegalRedirect() {
  permanentRedirect('/terms#listing-policy');
}
