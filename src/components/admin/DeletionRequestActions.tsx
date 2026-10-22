'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeletionRequestActions({ id, status }: { id: string; status: string }) {
  const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const actions=status==='requested'?['processing','cancelled']:status==='processing'?['completed','cancelled']:[];
  async function update(next:string){const reason=window.prompt(`Reason for ${next}:`)??'';setBusy(true);setError('');const response=await fetch(`/api/admin/operations/deletions/${encodeURIComponent(id)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next,reason})});setBusy(false);if(!response.ok){setError('Could not update request.');return;}router.refresh();}
  return <div className="mt-2 flex flex-wrap gap-2">{actions.map((action)=><button key={action} disabled={busy} onClick={()=>void update(action)} className="border border-gold-600/30 px-3 py-1 text-xs uppercase disabled:opacity-50">{action}</button>)}{error&&<span className="text-xs text-crimson-400">{error}</span>}</div>;
}
