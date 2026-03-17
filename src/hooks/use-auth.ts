'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import useSWR from 'swr'

export function useAuth() {
    const [user, setUser] = useState<User | null>(null)
    const [authLoading, setAuthLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function getInitialUser() {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            setAuthLoading(false)
        }

        getInitialUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event: AuthChangeEvent, session: Session | null) => {
                setUser(session?.user ?? null)
                setAuthLoading(false)
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    // Fetch profile with SWR
    const { data: profile, isLoading: profileLoading } = useSWR(user ? ['profile', user.id] : null, async () => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user!.id)
            .single()
        return data as Profile
    }, {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        staleTime: 1000 * 60 * 60, // 1 hour
    })

    return { 
        user, 
        profile, 
        loading: authLoading || (!!user && profileLoading && !profile)
    }
}
