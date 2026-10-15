'use client';

import * as React from 'react';
import {
  Toaster as Sonner,
  toast as sonnerToast,
  type ToasterProps,
  type ExternalToast,
} from 'sonner';
import { StatusPill, type StatusKind } from '@/components/hudoor/status-pill';

/**
 * Toast — sonner wrapper.
 *
 * Status toasts render a StatusPill (icon + label + color) so meaning never
 * depends on color alone.
 *
 *   import { toast } from '@/components/hudoor/toast';
 *   toast.status('present', 'اتسجل حضورك', 'قاعة 204 · 08:03 ص');
 *   toast.error('تعذر الاتصال بالخادم');
 */
export function Toast({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      position="bottom-center"
      offset={96}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            'group flex items-start gap-3 rounded-[calc(var(--radius)-2px)] border border-border bg-card px-4 py-3 text-card-foreground shadow-lg [&_[data-icon]]:hidden',
          title: 'text-sm font-medium leading-6',
          description: 'text-sm text-muted-foreground',
          cancelButton: 'text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}

/* StatusPill localizes its own label via useApp (it renders inside the
   Providers tree through the mounted <Toast /> component). */
export const toast = {
  /** Status toast: StatusPill (icon + label + color) + message. */
  status: (
    status: StatusKind,
    message: string,
    description?: string,
    options?: ExternalToast
  ) =>
    sonnerToast(
      <span className="flex items-center gap-2">
        <StatusPill status={status} />
        <span>{message}</span>
      </span>,
      { description, ...options }
    ),
  success: (message: string, options?: ExternalToast) => sonnerToast.success(message, options),
  error: (message: string, options?: ExternalToast) => sonnerToast.error(message, options),
  warning: (message: string, options?: ExternalToast) => sonnerToast.warning(message, options),
  info: (message: string, options?: ExternalToast) => sonnerToast.info(message, options),
  message: (message: string, options?: ExternalToast) => sonnerToast(message, options),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};
