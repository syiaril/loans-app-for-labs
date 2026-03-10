'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

/**
 * Hook for auto-logout after inactivity.
 * Tracks mouse, keyboard, touch, and scroll events.
 * @param timeoutMs - Inactivity timeout in milliseconds (default: 60000 = 1 minute)
 */
export function useIdleLogout(timeoutMs: number = 60000) {
    const router = useRouter()
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isLoggingOut = useRef(false)

    const logout = useCallback(async () => {
        if (isLoggingOut.current) return
        isLoggingOut.current = true

        try {
            const supabase = createClient()
            await supabase.auth.signOut()
        } catch {
            // ignore
        }

        toast.info('Sesi habis karena tidak ada aktivitas.', {
            duration: 5000,
        })
        router.replace('/')
    }, [router])

    const resetTimer = useCallback(() => {
        // Clear existing timers
        if (timerRef.current) clearTimeout(timerRef.current)
        if (warningRef.current) clearTimeout(warningRef.current)

        // Warning 10 seconds before logout
        warningRef.current = setTimeout(() => {
            toast.warning('Sesi akan berakhir dalam 10 detik karena tidak ada aktivitas...', {
                duration: 8000,
                id: 'idle-warning',
            })
        }, timeoutMs - 10000)

        // Actual logout
        timerRef.current = setTimeout(() => {
            logout()
        }, timeoutMs)
    }, [timeoutMs, logout])

    useEffect(() => {
        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

        function handleActivity() {
            resetTimer()
        }

        // Start timer on mount
        resetTimer()

        // Listen for user activity
        events.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true })
        })

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            if (warningRef.current) clearTimeout(warningRef.current)
            events.forEach(event => {
                window.removeEventListener(event, handleActivity)
            })
        }
    }, [resetTimer])
}
