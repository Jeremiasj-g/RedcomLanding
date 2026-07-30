'use client';

import { toast, type Id, type ToastOptions } from 'react-toastify';

const DEFAULT_OPTIONS: ToastOptions = {
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

export function errorMessage(error: unknown, fallback = 'Ocurrió un error inesperado.') {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

export const notify = {
  success(message: string, options?: ToastOptions) {
    return toast.success(message, { ...DEFAULT_OPTIONS, ...options });
  },
  error(message: string, options?: ToastOptions) {
    return toast.error(message, {
      ...DEFAULT_OPTIONS,
      autoClose: 4800,
      ...options,
    });
  },
  warning(message: string, options?: ToastOptions) {
    return toast.warning(message, { ...DEFAULT_OPTIONS, ...options });
  },
  info(message: string, options?: ToastOptions) {
    return toast.info(message, { ...DEFAULT_OPTIONS, ...options });
  },
  loading(message: string, options?: ToastOptions) {
    return toast.loading(message, {
      ...DEFAULT_OPTIONS,
      closeOnClick: false,
      ...options,
    });
  },
  update(
    id: Id,
    options: ToastOptions & { render?: string; isLoading?: boolean },
  ) {
    toast.update(id, options);
  },
  dismiss(id?: Id) {
    toast.dismiss(id);
  },
  promise<T>(
    promise: Promise<T>,
    messages: { pending: string; success: string; error: string },
    options?: ToastOptions,
  ) {
    return toast.promise(promise, messages, {
      ...DEFAULT_OPTIONS,
      ...options,
    });
  },
};
