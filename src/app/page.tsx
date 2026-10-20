'use client'

import { useSyncExternalStore } from 'react'
import { LockScreen } from '@/components/lock-screen'
import { AppShell } from '@/components/app-shell'
import { useCafeStore } from '@/store/cafe-store'

// Avoid hydration mismatch: server returns null, client renders the actual app
const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export default function Home() {
  const user = useCafeStore((s) => s.user)
  const hydrated = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot)

  if (!hydrated) return null

  return user ? <AppShell /> : <LockScreen />
}
