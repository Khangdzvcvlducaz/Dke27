'use client'

import * as React from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: 'class'
  defaultTheme?: Theme
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  React.useEffect(() => {
    const stored = (typeof window !== 'undefined' && localStorage.getItem('theme')) as Theme | null
    const theme = stored || defaultTheme
    const resolved = theme === 'system' && enableSystem
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme
    const root = document.documentElement
    if (disableTransitionOnChange) {
      const css = document.createElement('style')
      css.appendChild(document.createTextNode('*{transition:none!important}'))
      document.head.appendChild(css)
      setTimeout(() => document.head.removeChild(css), 1)
    }
    root.classList.remove('light', 'dark')
    root.classList.add(resolved)
  }, [defaultTheme, enableSystem, disableTransitionOnChange])

  return <>{children}</>
}

export function useTheme() {
  const [theme, setThemeState] = React.useState<Theme>('light')
  React.useEffect(() => {
    const stored = (localStorage.getItem('theme') as Theme | null) || 'light'
    setThemeState(stored)
  }, [])

  const setTheme = (t: Theme) => {
    localStorage.setItem('theme', t)
    setThemeState(t)
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    if (t === 'system') {
      const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefers ? 'dark' : 'light')
    } else {
      root.classList.add(t)
    }
  }

  return { theme, setTheme }
}
