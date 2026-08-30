import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim fixed inset-0 z-40 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-[12vh] z-50 w-[92vw] -translate-x-1/2 rounded-lg border border-line bg-raised shadow-[var(--shadow-panel)] data-[state=open]:animate-fade-rise',
            size === 'lg' ? 'max-w-3xl' : 'max-w-lg',
          )}
        >
          <header className="flex items-start justify-between gap-6 border-b border-line px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-[15px] font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[13px] text-muted">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="rounded p-1 text-faint transition-colors hover:bg-sunken hover:text-ink">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </header>
          <div className="px-5 py-4">{children}</div>
          {footer ? <footer className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
