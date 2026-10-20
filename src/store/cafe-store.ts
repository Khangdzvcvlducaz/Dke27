'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'admin' | 'staff' | null

interface CartItem {
  menuId: string
  icon: string
  name: string
  price: number
  qty: number
  notes: string[]
}

interface AuthUser {
  name: string
  role: Role
  view: string | null
  staffId?: string
}

interface CafeState {
  // auth
  user: AuthUser | null
  setUser: (u: AuthUser | null) => void
  logout: () => void

  // cafe
  cafeName: string
  adminName: string
  logo: string | null
  setCafe: (data: { name?: string; adminName?: string; logo?: string | null }) => void

  // view
  currentView: string
  setCurrentView: (v: string) => void

  // cart
  cart: CartItem[]
  cartType: 'stay' | 'take'
  cartTableCode: string | null
  cartCustomer: string
  cartDiscountCode: string
  setCartType: (t: 'stay' | 'take') => void
  setCartTable: (code: string | null) => void
  setCartCustomer: (name: string) => void
  setCartDiscount: (code: string) => void
  addToCart: (item: Omit<CartItem, 'qty' | 'notes'>) => void
  updateQty: (i: number, delta: number) => void
  toggleNote: (i: number, note: string) => void
  clearCart: () => void

  // realtime state
  cloudOnline: boolean
  setCloudOnline: (b: boolean) => void

  // cart sheet open
  cartSheetOpen: boolean
  setCartSheetOpen: (b: boolean) => void
}

export const useCafeStore = create<CafeState>()(
  persist(
    (set, _get) => ({
      user: null,
      setUser: (u) => set({ user: u }),
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cfh-me')
        }
        set({ user: null, currentView: 'pos', cart: [], cartSheetOpen: false })
      },

      cafeName: 'Đông Không Em?',
      adminName: 'Admin',
      logo: null,
      setCafe: (data) =>
        set((s) => ({
          cafeName: data.name ?? s.cafeName,
          adminName: data.adminName ?? s.adminName,
          logo: data.logo !== undefined ? data.logo : s.logo,
        })),

      currentView: 'pos',
      setCurrentView: (v) => set({ currentView: v }),

      cart: [],
      cartType: 'stay',
      cartTableCode: null,
      cartCustomer: '',
      cartDiscountCode: '',
      setCartType: (t) => set({ cartType: t }),
      setCartTable: (c) => set({ cartTableCode: c }),
      setCartCustomer: (n) => set({ cartCustomer: n }),
      setCartDiscount: (c) => set({ cartDiscountCode: c }),

      addToCart: (item) =>
        set((s) => {
          const existing = s.cart.find((c) => c.menuId === item.menuId && c.notes.length === 0)
          if (existing) {
            return {
              cart: s.cart.map((c) =>
                c === existing ? { ...c, qty: c.qty + 1 } : c
              ),
            }
          }
          return { cart: [...s.cart, { ...item, qty: 1, notes: [] }] }
        }),

      updateQty: (i, delta) =>
        set((s) => {
          const next = [...s.cart]
          next[i] = { ...next[i], qty: next[i].qty + delta }
          if (next[i].qty <= 0) next.splice(i, 1)
          return { cart: next }
        }),

      toggleNote: (i, note) =>
        set((s) => {
          const next = [...s.cart]
          const exists = next[i].notes.includes(note)
          next[i] = {
            ...next[i],
            notes: exists
              ? next[i].notes.filter((n) => n !== note)
              : [...next[i].notes, note],
          }
          return { cart: next }
        }),

      clearCart: () =>
        set({ cart: [], cartType: 'stay', cartTableCode: null, cartCustomer: '', cartDiscountCode: '' }),

      cloudOnline: false,
      setCloudOnline: (b) => set({ cloudOnline: b }),

      cartSheetOpen: false,
      setCartSheetOpen: (b) => set({ cartSheetOpen: b }),
    }),
    {
      name: 'cfh-store',
      partialize: (s) => ({
        user: s.user,
        cafeName: s.cafeName,
        adminName: s.adminName,
        logo: s.logo,
        currentView: s.currentView,
      }),
    }
  )
)

export const cartTotal = (cart: CartItem[]) =>
  cart.reduce((s, c) => s + c.price * c.qty, 0)

export const cartCount = (cart: CartItem[]) =>
  cart.reduce((s, c) => s + c.qty, 0)
