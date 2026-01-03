'use client';

import { useEffect, useMemo, useReducer } from 'react';
import { datetimeLocalToISO, isoToDatetimeLocal } from '@/utils/datetime';
import type { AnnouncementType, Severity } from './types';

export type FormState = {
  type: AnnouncementType;
  title: string;
  content: string;
  severity: Severity;
  requireAck: boolean;
  pinned: boolean;

  startsAt: string; // datetime-local
  endsAt: string; // datetime-local | ''

  audAll: boolean;
  audRoles: string[];
  audBranches: string[];

  isPublished: boolean;
  isActive: boolean;

  saving: boolean;
  errorMsg: string | null;
};

type FormAction =
  | { type: 'hydrate'; payload: Partial<FormState> }
  | { type: 'set'; key: keyof FormState; value: any }
  | { type: 'reset'; payload: FormState };

function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ...action.payload };
    case 'set':
      return { ...state, [action.key]: action.value };
    case 'reset':
      return action.payload;
    default:
      return state;
  }
}

export function makeInitialState(initial?: any): FormState {
  const now = isoToDatetimeLocal(new Date().toISOString());

  return {
    type: (initial?.type ?? 'news') as AnnouncementType,
    title: initial?.title ?? '',
    content: initial?.content ?? '',
    severity: (initial?.severity ?? 'info') as Severity,
    requireAck: Boolean(initial?.require_ack ?? false),
    pinned: Boolean(initial?.pinned ?? false),

    startsAt: initial?.starts_at ? isoToDatetimeLocal(initial.starts_at) : now,
    endsAt: initial?.ends_at ? isoToDatetimeLocal(initial.ends_at) : '',

    audAll: Boolean(initial?.audience?.all ?? true),
    audRoles: initial?.audience?.roles ?? [],
    audBranches: initial?.audience?.branches ?? [],

    isPublished: Boolean(initial?.is_published ?? true),
    isActive: Boolean(initial?.is_active ?? true),

    saving: false,
    errorMsg: null,
  };
}

export function useAnnouncementForm(initial?: any) {
  const [state, dispatch] = useReducer(reducer, initial, makeInitialState);

  // ✅ FIX PLANTILLAS: rehidrata cuando cambia el contenido, no solo el id
  const signature = useMemo(() => JSON.stringify(initial ?? {}), [initial]);

  useEffect(() => {
    dispatch({ type: 'reset', payload: makeInitialState(initial) });
  }, [signature]); // <- clave

  // ✅ Si no es popup, ACK no aplica
  useEffect(() => {
    if (state.type !== 'important_alert' && state.requireAck) {
      dispatch({ type: 'set', key: 'requireAck', value: false });
    }
  }, [state.type, state.requireAck]);

  // ✅ audAll limpia filtros
  useEffect(() => {
    if (state.audAll && (state.audRoles.length || state.audBranches.length)) {
      dispatch({ type: 'hydrate', payload: { audRoles: [], audBranches: [] } });
    }
  }, [state.audAll]);

  const audience = useMemo(() => {
    if (state.audAll) return { all: true };
    const out: any = { all: false };
    if (state.audRoles.length) out.roles = state.audRoles;
    if (state.audBranches.length) out.branches = state.audBranches;
    return out;
  }, [state.audAll, state.audRoles, state.audBranches]);

  const canSave = useMemo(() => {
    if (!state.title.trim() || !state.content.trim()) return false;

    const sISO = datetimeLocalToISO(state.startsAt);
    if (!sISO) return false;

    const eISO = datetimeLocalToISO(state.endsAt);
    if (eISO && new Date(eISO).getTime() < new Date(sISO).getTime()) return false;

    return true;
  }, [state.title, state.content, state.startsAt, state.endsAt]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    dispatch({ type: 'set', key, value });

  const reset = () => dispatch({ type: 'reset', payload: makeInitialState(undefined) });

  return { state, set, audience, canSave, reset, dispatch };
}
