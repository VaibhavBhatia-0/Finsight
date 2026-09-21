import type { CSSProperties } from 'react';

type BrandLogoVariant = 'wordmark' | 'lockup' | 'mark';

interface BrandLogoProps {
  className?: string;
  variant?: BrandLogoVariant;
  tagline?: boolean;
}

function BrandSpark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 0c1.18 9.62 6.38 14.82 16 16-9.62 1.18-14.82 6.38-16 16C14.82 22.38 9.62 17.18 0 16 9.62 14.82 14.82 9.62 16 0Z" />
    </svg>
  );
}

export default function BrandLogo({ className = '', variant = 'wordmark', tagline = false }: BrandLogoProps) {
  const classes = ['brand-logo', `brand-logo--${variant}`, className].filter(Boolean).join(' ');
  const style = { '--brand-word-length': '8ch' } as CSSProperties;

  return (
    <span className={classes} style={style} aria-label="finsight">
      {(variant === 'lockup' || variant === 'mark') && (
        <span className="brand-logo-mark" aria-hidden="true">
          <span>f</span>
          <BrandSpark className="brand-logo-mark-spark" />
        </span>
      )}
      {variant === 'lockup' && <span className="brand-logo-divider" aria-hidden="true" />}
      {variant !== 'mark' && (
        <span className="brand-logo-word" aria-hidden="true">
          finsight
          <BrandSpark className="brand-logo-word-spark" />
        </span>
      )}
      {tagline && variant !== 'mark' && <span className="brand-logo-tagline" aria-hidden="true">invest brighter</span>}
    </span>
  );
}

