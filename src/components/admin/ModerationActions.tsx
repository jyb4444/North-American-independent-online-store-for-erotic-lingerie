'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ModerationActions({ endpoint, actions }: { endpoint: string; actions: { value: string; label: string }[] }) {
  const router = useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function act(value:string){setBusy(true);setError('');const res=await fetch(endpoint,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(endpoint.includes('/returns/')?{status:value}:{decision:value})});if(res.ok)router.refresh();else setError((await res.json()).error??'Update failed');setBusy(false)}
  return <div className="mt-3 flex flex-wrap gap-2">{actions.map(a=><button disabled={busy} key={a.value} onClick={()=>act(a.value)} className="border border-gold-400 px-3 py-2 text-xs text-gold-400 disabled:opacity-50">{a.label}</button>)}{error&&<p className="w-full text-xs text-crimson-400">{error}</p>}</div>;
}
