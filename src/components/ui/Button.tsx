import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';
export type ButtonSize = 'default' | 'small';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: '',
  secondary: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  ghost: 'ghost'
};

export function Button({ variant = 'primary', size = 'default', icon, className, children, ...rest }: ButtonProps) {
  const classes = ['btn', VARIANT_CLASS[variant], size === 'small' ? 'small' : '', className].filter(Boolean).join(' ');
  return (
    <button className={classes} {...rest}>
      {icon}
      {children}
    </button>
  );
}
