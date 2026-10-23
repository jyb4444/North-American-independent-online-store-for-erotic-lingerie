'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeletionRequestActions({ id, status }: { id: string; status: string }) {
  const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const actions=status==='requested'?['processing','cancelled']:status==='processing'?['completed','cancelled']:[];
  async function update(next:string){
    const reason=window.prompt(next==='completed'?'Enter at least 20 characters of deletion/anonymization evidence:':`Reason for ${next}:`)??'';
    if(next==='completed'&&reason.trim().length<20){setError('Completion evidence must be at least 20 characters.');return;}
    const attestation=next==='completed'?window.prompt('After completing every runbook step, type DELETE COMPLETED:')??'':'';
    if(next==='completed'&&attestation!=='DELETE COMPLETED'){setError('Deletion completion was not confirmed.');return;}
    setBusy(true);setError('');const response=await fetch(`/api/admin/operations/deletions/${encodeURIComponent(id)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next,reason,attestation})});setBusy(false);if(!response.ok){setError('Could not update request.');return;}router.refresh();
  }
  return <div className="mt-2"><div className="flex flex-wrap gap-2">{actions.map((action)=><button key={action} disabled={busy} onClick={()=>void update(action)} className="border border-gold-600/30 px-3 py-1 text-xs uppercase disabled:opacity-50">{action}</button>)}{error&&<span className="text-xs text-crimson-400">{error}</span>}</div>{status==='processing'&&<p className="mt-2 max-w-xl text-xs leading-5 text-ivory-muted">Before completion, follow <code>docs/account-deletion-runbook.md</code>, delete or anonymize eligible Supabase/Auth/Shopify data, record retained categories, and verify sign-in recovery is disabled. The completion action requires evidence and an explicit attestation.</p>}</div>;
}
