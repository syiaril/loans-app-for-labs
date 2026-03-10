'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/lib/types/database'

interface CartStore {
    items: CartItem[]
    addItem: (item: CartItem) => void
    removeItem: (itemId: number) => void
    clearCart: () => void
    isInCart: (itemId: number) => boolean
}

export const useCart = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            addItem: (item) => {
                const existing = get().items.find((i) => i.id === item.id)
                if (!existing) {
                    set({ items: [...get().items, item] })
                }
            },
            removeItem: (itemId) => {
                set({ items: get().items.filter((i) => i.id !== itemId) })
            },
            clearCart: () => {
                set({ items: [] })
            },
            isInCart: (itemId) => {
                return get().items.some((i) => i.id === itemId)
            },
        }),
        {
            name: 'loan-cart',
        }
    )
)
