'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RetryButton({ endpoint }: { endpoint: string }) {
  const router = useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function retry(){setBusy(true);setError('');const response=await fetch(endpoint,{method:'POST'});const body=await response.json().catch(()=>({})) as {error?:string};setBusy(false);if(!response.ok){setError(body.error??'Retry failed');return;}router.refresh();}
  return <div className="mt-3"><button type="button" onClick={retry} disabled={busy} className="border border-gold-400 px-3 py-2 text-xs uppercase tracking-widest text-gold-400 disabled:opacity-50">{busy?'Queuing…':'Retry safely'}</button>{error&&<p className="mt-2 text-xs text-crimson-400">{error}</p>}</div>;
}
