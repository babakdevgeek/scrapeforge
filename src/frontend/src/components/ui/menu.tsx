import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  children,
  align = 'end',
  className,
}: {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-[190px] overflow-hidden rounded-md border border-line bg-raised p-1 text-[13px] shadow-[var(--shadow-panel)]',
          'data-[state=open]:animate-fade-rise',
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  tone = 'default',
  shortcut,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  tone?: 'default' | 'danger';
  shortcut?: string;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-default select-none items-center justify-between gap-6 rounded-sm px-2 py-1.5 outline-none transition-colors',
        tone === 'danger'
          ? 'text-danger data-[highlighted]:bg-[color:var(--danger)]/12'
          : 'text-ink data-[highlighted]:bg-sunken',
      )}
    >
      <span className="flex items-center gap-2">{children}</span>
      {shortcut ? <span className="font-mono text-2xs text-faint">{shortcut}</span> : null}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <DropdownMenu.Label className="label px-2 pb-1 pt-1.5">{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}
