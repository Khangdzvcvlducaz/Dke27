'use client'

import { useState } from 'react'

interface BrandLogoProps {
  variant?: 'full' | 'mini' | 'stamp'
  className?: string
  logoUrl?: string | null
  cafeName?: string
}

/** Inline SVG fallback logo "Đông Không Em?" */
function FallbackSVG({ variant }: { variant: 'full' | 'mini' | 'stamp' }) {
  if (variant === 'mini') {
    return (
      <svg viewBox="0 0 64 64" className="w-9 h-9" xmlns="http://www.w3.org/2000/svg" aria-label="Đông Không Em?">
        <circle cx="32" cy="32" r="29" fill="var(--background, #fffbf2)" stroke="var(--primary, #b3202c)" strokeWidth="3" />
        <g transform="translate(31,34) scale(.62)" fill="var(--primary)" stroke="var(--primary)">
          <path d="M-14 0 h28 v8 a11 11 0 0 1 -11 11 h-6 a11 11 0 0 1 -11 -11 z" stroke="none" />
          <path d="M14 3 h4 a5.5 5.5 0 0 1 0 11 h-3.5" fill="none" strokeWidth="3.4" />
          <rect x="-20" y="22" width="40" height="4" rx="2" stroke="none" />
          <path d="M-10 -7 C-8 -23, 8 -27, 15 -17 L 12 -7 Z" stroke="none" />
          <rect x="-13" y="-7" width="26" height="6" rx="3" fill="var(--background)" strokeWidth="2.4" />
          <circle cx="15" cy="-17" r="4" fill="var(--background)" strokeWidth="2.4" />
        </g>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 300 200" className="w-full max-w-[210px] h-auto" xmlns="http://www.w3.org/2000/svg" aria-label="Đông Không Em?">
      <g fill="var(--primary, #b3202c)" stroke="var(--primary, #b3202c)">
        <text x="262" y="52" fontSize="14" fill="var(--primary)">♪</text>
        <text x="28" y="84" fontSize="11" fill="var(--primary)" opacity=".55">♫</text>
        <text x="252" y="120" fontSize="9" fill="var(--primary)" opacity=".45">♪</text>
        <text x="14" y="20" fontSize="11" fill="var(--primary)" opacity=".5">❄</text>
        <text x="276" y="98" fontSize="10" fill="var(--primary)" opacity=".5">❄</text>
      </g>
      <text x="150" y="106" textAnchor="middle" fontFamily="var(--font-oswald), Arial Narrow, sans-serif" fontSize="48" fill="var(--primary)" letterSpacing="4" fontWeight="700">ĐÔNG</text>
      <text x="150" y="152" textAnchor="middle" fontFamily="var(--font-oswald), Arial Narrow, sans-serif" fontSize="42" fill="var(--primary)" letterSpacing="1" fontWeight="700">KHÔNG EM?</text>
      <text x="150" y="178" textAnchor="middle" fontFamily="var(--font-vietnam), sans-serif" fontWeight="700" fontSize="11" letterSpacing="5" fill="var(--primary)">COFFEE &amp; SINGING</text>
    </svg>
  )
}

export function BrandLogo({ variant = 'full', className = '', logoUrl, cafeName = 'Đông Không Em?' }: BrandLogoProps) {
  const [erroredUrls, setErroredUrls] = useState<Set<string>>(new Set())
  const imgError = logoUrl ? erroredUrls.has(logoUrl) : false

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={`Logo ${cafeName}`}
        className={
          variant === 'mini'
            ? 'h-9 w-auto rounded-lg object-contain ' + className
            : 'w-full max-w-[210px] h-auto object-contain ' + className
        }
        onError={() => {
          if (logoUrl) setErroredUrls((s) => new Set(s).add(logoUrl))
        }}
      />
    )
  }
  return (
    <div className={className}>
      <FallbackSVG variant={variant} />
    </div>
  )
}
