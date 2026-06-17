'use client';

import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Check, MapPin, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';

type Address = Database['public']['Tables']['addresses']['Row'];
type AddressForm = Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

const EMPTY_FORM: AddressForm = {
  full_name: '', phone: '', address_line1: '', address_line2: '',
  city: '', state: '', zip: '', country: 'US', is_default: false,
};

function AddressField({
  form,
  label,
  name,
  required,
  placeholder,
  half,
  setForm,
}: {
  form: AddressForm;
  label: string;
  name: keyof AddressForm;
  required?: boolean;
  placeholder?: string;
  half?: boolean;
  setForm: Dispatch<SetStateAction<AddressForm>>;
}) {
  return (
    <div className={half ? '' : 'col-span-2'}>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
        {label}{required && ' *'}
      </label>
      <input
        type="text"
        value={form[name] as string}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        required={required}
        placeholder={placeholder}
        className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
      />
    </div>
  );
}

export default function AddressesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchAddresses = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', uid)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setAddresses(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
      void fetchAddresses(user.id);
    });
  }, [fetchAddresses, router, supabase.auth]);

  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, is_default: addresses.length === 0 });
    setFormError('');
    setShowForm(true);
  }

  function openEdit(address: Address) {
    setEditingId(address.id);
    setForm({
      full_name: address.full_name, phone: address.phone ?? '',
      address_line1: address.address_line1, address_line2: address.address_line2 ?? '',
      city: address.city, state: address.state, zip: address.zip,
      country: address.country, is_default: address.is_default,
    });
    setFormError('');
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    // If setting as default, unset all others first
    if (form.is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
    }

    if (editingId) {
      const { error } = await supabase
        .from('addresses')
        .update({ ...form })
        .eq('id', editingId);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from('addresses')
        .insert({ ...form, user_id: userId });
      if (error) { setFormError(error.message); setSaving(false); return; }
    }

    setSaving(false);
    setShowForm(false);
    void fetchAddresses(userId);
  }

  async function handleDelete(id: string) {
    await supabase.from('addresses').delete().eq('id', id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSetDefault(address: Address) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
    await supabase.from('addresses').update({ is_default: true }).eq('id', address.id);
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, is_default: a.id === address.id }))
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Account</p>
          <h1 className="font-serif text-3xl font-light text-ivory">Addresses</h1>
        </div>
        <Link href="/account" className="text-xs uppercase tracking-widest text-ivory-dim transition hover:text-gold-400">
          ← Account
        </Link>
      </div>

      {/* Address List */}
      {addresses.length === 0 && !showForm ? (
        <div className="flex h-56 flex-col items-center justify-center border border-gold-600/20 bg-wine-900 text-center">
          <MapPin size={32} className="mb-3 text-wine-700" />
          <p className="font-serif text-lg font-light italic text-ivory-muted">No addresses saved</p>
          <button onClick={openNew}
            className="mt-5 border border-gold-400 px-6 py-2.5 text-xs uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950">
            Add Address
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div key={address.id}
              className={`border bg-wine-900 p-5 transition ${address.is_default ? 'border-gold-400/40' : 'border-gold-600/20'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ivory">{address.full_name}</p>
                    {address.is_default && (
                      <span className="border border-gold-400/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold-400">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ivory-muted">{address.address_line1}</p>
                  {address.address_line2 && <p className="text-xs text-ivory-muted">{address.address_line2}</p>}
                  <p className="text-xs text-ivory-muted">{address.city}, {address.state} {address.zip}</p>
                  <p className="text-xs text-ivory-muted">{address.country}</p>
                  {address.phone && <p className="mt-1 text-xs text-ivory-dim">{address.phone}</p>}
                </div>

                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(address)}
                      className="text-ivory-dim hover:text-gold-400 transition" title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(address.id)}
                      className="text-ivory-dim hover:text-crimson-400 transition" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {!address.is_default && (
                    <button onClick={() => handleSetDefault(address)}
                      className="text-xs uppercase tracking-widest text-ivory-dim transition hover:text-gold-400">
                      Set default
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {!showForm && (
            <button onClick={openNew}
              className="flex w-full items-center justify-center gap-2 border border-dashed border-gold-600/30 py-4 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400/50 hover:text-gold-400">
              <Plus size={14} /> Add New Address
            </button>
          )}
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="mt-6 border border-gold-600/25 bg-wine-900 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-serif text-lg font-light text-ivory">
              {editingId ? 'Edit Address' : 'New Address'}
            </h2>
            <button onClick={() => setShowForm(false)} className="text-ivory-dim hover:text-gold-400 transition">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-2 gap-3">
            <AddressField form={form} setForm={setForm} label="Full Name" name="full_name" required />
            <AddressField form={form} setForm={setForm} label="Phone" name="phone" placeholder="+1 555 000 0000" half />
            <AddressField form={form} setForm={setForm} label="Country" name="country" required half />
            <AddressField form={form} setForm={setForm} label="Address Line 1" name="address_line1" required placeholder="123 Main St" />
            <AddressField form={form} setForm={setForm} label="Address Line 2" name="address_line2" placeholder="Apt, Suite, etc." />
            <AddressField form={form} setForm={setForm} label="City" name="city" required half />
            <AddressField form={form} setForm={setForm} label="State / Province" name="state" required half />
            <AddressField form={form} setForm={setForm} label="ZIP / Postal Code" name="zip" required half />

            <div className="col-span-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_default: !f.is_default }))}
                className={`flex h-4 w-4 items-center justify-center border transition ${form.is_default ? 'border-gold-400 bg-gold-400' : 'border-wine-700'}`}
              >
                {form.is_default && <Check size={10} className="text-wine-950" />}
              </button>
              <span className="text-xs text-ivory-muted">Set as default address</span>
            </div>

            {formError && (
              <p className="col-span-2 border border-crimson-400/30 bg-crimson-700/10 px-3 py-2 text-xs text-crimson-400">
                {formError}
              </p>
            )}

            <div className="col-span-2 flex gap-3 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 border border-gold-400 py-3 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:opacity-50">
                {saving ? '...' : editingId ? 'Save Changes' : 'Add Address'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="border border-wine-700 px-5 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-600/50 hover:text-gold-400">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
