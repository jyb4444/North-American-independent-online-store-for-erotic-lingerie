import { redirect } from 'next/navigation';

/** The retired fit-profile URL no longer collects sensitive body measurements. */
export default function RetiredFitProfilePage() {
  redirect('/account');
}
