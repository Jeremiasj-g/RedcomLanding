'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type BranchOption = {
  id: string;
  label: string; // name (ej: "Corrientes")
  value: string; // code (ej: "corrientes")
};

export function useBranches() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from('branches')
      .select('id,code,name')
      .order('name', { ascending: true });

    if (error) {
      console.error('[useBranches] error:', error);
      setBranches([]);
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    const mapped: BranchOption[] = (data ?? []).map((b: any) => ({
      id: String(b.id),
      value: String(b.code).trim().toLowerCase(),
      label: String(b.name ?? b.code),
    }));

    setBranches(mapped);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return { branches, loading, errorMsg, refetch: load };
}
