import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, useEffect, useRef, useState, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

// ---------- Button ----------
type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
type ButtonSize = 'default' | 'sm' | 'icon';
export function Button({ className, variant = 'default', size = 'default', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  const variants: Record<ButtonVariant, string> = {
    default: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm shadow-primary/20',
    outline: 'border border-border bg-transparent hover:bg-muted/50 hover:border-primary/40',
    ghost: 'hover:bg-muted/50',
    destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  };
  const sizes: Record<ButtonSize, string> = { default: 'h-9 px-4 text-sm', sm: 'h-8 px-3 text-xs', icon: 'h-9 w-9' };
  return <button className={cn('inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-all disabled:opacity-50 disabled:pointer-events-none', variants[variant], sizes[size], className)} {...props} />;
}

// ---------- Card ----------
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-semibold', className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

// ---------- Input / Label / Textarea ----------
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', className)} {...props} />;
}
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} {...props} />;
}
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium leading-none', className)} {...props} />;
}

// ---------- Badge ----------
export function Badge({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'secondary' | 'outline' | 'destructive' }) {
  const variants = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-border text-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
  };
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variants[variant], className)} {...props} />;
}

// ---------- Skeleton ----------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} />;
}

// ---------- Avatar ----------
export function Avatar({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('relative flex shrink-0 overflow-hidden rounded-full', className)}>{children}</div>;
}
export function AvatarImage({ src }: { src?: string }) {
  if (!src) return null;
  return <img src={src} className="aspect-square h-full w-full object-cover" />;
}
export function AvatarFallback({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex h-full w-full items-center justify-center', className)}>{children}</div>;
}

// ---------- Separator ----------
export function Separator({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-border', className)} />;
}

// ---------- Switch ----------
export function Switch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onCheckedChange(!checked)}
      className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0', checked ? 'bg-primary' : 'bg-muted')}>
      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', checked ? 'translate-x-4.5' : 'translate-x-0.5')} />
    </button>
  );
}

// ---------- Select (native, styled) ----------
interface SelectOpt { value: string; label: ReactNode }
interface SelectCtx { value: string; onValueChange: (v: string) => void; options: SelectOpt[] }
const SelectContext = createContext<SelectCtx | null>(null);

export function Select({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) {
  const options: SelectOpt[] = [];
  extractItems(children, options); // pulls SelectItem values out of the SelectContent sibling
  return <SelectContext.Provider value={{ value, onValueChange, options }}>{children}</SelectContext.Provider>;
}
function extractItems(children: ReactNode, out: SelectOpt[]) {
  const flat = Array.isArray(children) ? children.flat(Infinity) : [children];
  flat.forEach((c: any) => {
    if (!c) return;
    if (c.type === SelectContent) extractItems(c.props.children, out);
    else if (c.type === SelectItem) out.push({ value: c.props.value, label: c.props.children });
  });
}
export function SelectTrigger({ className, children }: { className?: string; children: ReactNode }) {
  const ctx = useContext(SelectContext)!;
  let placeholder: ReactNode = null;
  (Array.isArray(children) ? children : [children]).forEach((c: any) => { if (c?.type === SelectValue) placeholder = c.props.placeholder; });
  const hasMatch = ctx.options.some(o => o.value === ctx.value);
  return (
    <select className={cn('flex h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
      value={ctx.value} onChange={e => ctx.onValueChange(e.target.value)}>
      {!hasMatch && <option value={ctx.value} disabled hidden>{placeholder ?? ctx.value}</option>}
      {ctx.options.map(o => <option key={o.value} value={o.value}>{typeof o.label === 'string' ? o.label : o.value}</option>)}
    </select>
  );
}
// SelectContent/SelectItem never render real DOM — they exist purely so
// Select() above can read their props off the element tree. Rendering
// them for real would put stray <option> tags outside any <select>.
export function SelectContent({ children }: { children: ReactNode }) { return null; }
export function SelectItem({ value, children }: { value: string; children: ReactNode }) { return null; }
export function SelectValue({ placeholder }: { placeholder?: string }) { return null; }

// ---------- Dialog ----------
export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (v: boolean) => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
export function DialogContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin', className)}>{children}</div>;
}
export function DialogHeader({ children }: { children: ReactNode }) { return <div className="mb-4 space-y-1">{children}</div>; }
export function DialogTitle({ className, children }: { className?: string; children: ReactNode }) { return <h2 className={cn('text-lg font-semibold', className)}>{children}</h2>; }
export function DialogDescription({ children }: { children: ReactNode }) { return <p className="text-sm text-muted-foreground">{children}</p>; }
export function DialogFooter({ children }: { children: ReactNode }) { return <div className="mt-5 flex justify-end gap-2">{children}</div>; }

// ---------- AlertDialog (same visuals as Dialog) ----------
export const AlertDialog = Dialog;
export const AlertDialogContent = DialogContent;
export const AlertDialogHeader = DialogHeader;
export const AlertDialogTitle = DialogTitle;
export const AlertDialogDescription = DialogDescription;
export const AlertDialogFooter = DialogFooter;
export function AlertDialogCancel({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <Button variant="outline" {...props}>{children}</Button>; }
export function AlertDialogAction({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <Button className={className} {...props}>{children}</Button>; }

// ---------- DropdownMenu ----------
export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  return <DropdownContext.Provider value={{ open, setOpen }}><div className="relative inline-block" ref={ref}>{children}</div></DropdownContext.Provider>;
}
const DropdownContext = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);
export function DropdownMenuTrigger({ children }: { children: ReactNode; asChild?: boolean }) {
  const ctx = useContext(DropdownContext)!;
  return <span onClick={() => ctx.setOpen(!ctx.open)}>{children}</span>;
}
export function DropdownMenuContent({ align = 'start', className, children }: { align?: 'start' | 'end'; className?: string; children: ReactNode }) {
  const ctx = useContext(DropdownContext)!;
  if (!ctx.open) return null;
  return <div className={cn('absolute z-50 mt-1 min-w-[10rem] rounded-md border border-border bg-popover p-1 shadow-lg', align === 'end' ? 'right-0' : 'left-0', className)} onClick={() => ctx.setOpen(false)}>{children}</div>;
}
export function DropdownMenuItem({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-muted/60', className)} {...props}>{children}</div>;
}
export function DropdownMenuSeparator() { return <div className="my-1 h-px bg-border" />; }

// ---------- Tooltip (hover only, CSS-based) ----------
export function TooltipProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
export function Tooltip({ children }: { children: ReactNode }) { return <div className="group relative inline-flex">{children}</div>; }
export function TooltipTrigger({ children }: { children: ReactNode; asChild?: boolean }) { return <>{children}</>; }
export function TooltipContent({ children }: { children: ReactNode }) {
  return <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover border border-border px-2 py-1 text-xs opacity-0 shadow-md transition-opacity group-hover:opacity-100">{children}</span>;
}

// ---------- Toast re-export ----------
export { X };
