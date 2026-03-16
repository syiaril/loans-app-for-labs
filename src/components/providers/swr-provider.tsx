'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'

export function SWRProvider({ children }: { children: ReactNode }) {
    return (
        <SWRConfig
            value={{
                revalidateOnFocus: true,
                revalidateIfStale: true,
                dedupingInterval: 5000, // 5 seconds deduplication
                errorRetryCount: 3,
                fetcher: async (key: string) => {
                    // This is a placeholder, individual hooks will define their fetcher
                    // but global config allows setting default behaviors
                    return null
                }
            }}
        >
            {children}
        </SWRConfig>
    )
}
