'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SidebarContextType {
    collapsed: boolean
    setCollapsed: (v: boolean) => void
    toggle: () => void
}

const SidebarContext = createContext<SidebarContextType>({
    collapsed: false,
    setCollapsed: () => { },
    toggle: () => { },
})

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('sidebar-collapsed')
        if (saved === 'true') setCollapsed(true)
    }, [])

    function toggle() {
        setCollapsed(prev => {
            const next = !prev
            localStorage.setItem('sidebar-collapsed', String(next))
            return next
        })
    }

    return (
        <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle }}>
            {children}
        </SidebarContext.Provider>
    )
}

export function useSidebar() {
    return useContext(SidebarContext)
}
