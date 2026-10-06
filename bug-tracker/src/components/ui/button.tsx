import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors select-none disabled:opacity-45 disabled:pointer-events-none active:translate-y-px',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent active:bg-accent/70',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent/70',
        link: 'text-primary hover:underline underline-offset-2',
      },
      size: { default: 'h-8 px-3', sm: 'h-7 px-2.5 text-xs', lg: 'h-9 px-4', icon: 'h-8 w-8', 'icon-sm': 'h-7 w-7' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { loading?: boolean; asChild?: boolean }

export const Button = forwardRef<HTMLButtonElement, Props>(({ className, variant, size, loading, children, disabled, asChild, type = 'button', ...p }, ref) => {
  const cls = cn(buttonVariants({ variant, size }), className);
  if (asChild) return <Slot ref={ref} className={cls} {...p}>{children}</Slot>;
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} {...p}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
Button.displayName = 'Button';
