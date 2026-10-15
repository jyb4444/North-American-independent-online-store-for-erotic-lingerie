import { resetAndSeed } from './helpers/seed';

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (error) {
    throw new Error(`Local Supabase is not reachable at ${url} (${String(error)}). Run \`supabase start\` first.`);
  }

  await resetAndSeed();
}
