import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin-access';
import { createAdminClient } from '@/lib/supabase/server';
import ModerationActions from '@/components/admin/ModerationActions';

export default async function AdminReviewsPage(){if(!await currentAdmin())redirect('/account');const {data}=await createAdminClient().from('reviews').select('id,product_handle,rating,body,nickname,created_at').eq('approved',false).order('created_at',{ascending:true}).limit(100);return <main className="mx-auto max-w-4xl px-4 py-16"><h1 className="font-serif text-3xl">Pending Reviews</h1><div className="mt-8 space-y-4">{(data??[]).map(r=><article key={r.id} className="border border-gold-600/20 p-5"><p className="text-xs text-ivory-dim">{r.product_handle} · {r.rating}/5 · {r.nickname}</p><p className="mt-2">{r.body}</p><ModerationActions endpoint={`/api/admin/reviews/${r.id}`} actions={[{value:'approve',label:'Approve'},{value:'reject',label:'Reject & delete'}]}/></article>)}{!data?.length&&<p className="text-ivory-dim">No pending reviews.</p>}</div></main>}
