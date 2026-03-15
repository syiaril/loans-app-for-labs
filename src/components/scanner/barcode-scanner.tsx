'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Keyboard } from 'lucide-react'

interface BarcodeScannerProps {
    onScan: (barcode: string) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSearchResults?: (results: any[]) => void
    onSearchLoading?: (loading: boolean) => void
    placeholder?: string
    autoFocus?: boolean
}

export default function BarcodeScanner({
    onScan,
    onSearchResults,
    onSearchLoading,
    placeholder = 'Scan atau ketik barcode...',
    autoFocus = true,
}: BarcodeScannerProps) {
    const [manualInput, setManualInput] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus()
        }

        // Catch global keystrokes for the scanner
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Ignore if using modifier keys (Cmd, Ctrl, Alt)
            if (e.ctrlKey || e.metaKey || e.altKey) return

            const activeElement = document.activeElement as HTMLElement
            const isInput = activeElement.tagName === 'INPUT' || 
                            activeElement.tagName === 'TEXTAREA' || 
                            activeElement.isContentEditable

            // If we are already in another input, don't hijack
            if (isInput && activeElement !== inputRef.current) return

            // If we're not focused, focus us and append the char
            if (activeElement !== inputRef.current && inputRef.current) {
                // Focus the input
                inputRef.current.focus()

                // If it's a character, let's manually append it so we don't lose it
                if (e.key.length === 1) {
                    // Use direct DOM manipulation for the first char to ensure it's there
                    inputRef.current.value += e.key
                    // Still trigger state update for UI
                    setManualInput(inputRef.current.value)
                    e.preventDefault() 
                }
            }
        }

        window.addEventListener('keydown', handleGlobalKeyDown)
        return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [autoFocus])

    function handleInputChange(value: string) {
        setManualInput(value)

        // Realtime search — debounce 250ms
        if (debounceRef.current) clearTimeout(debounceRef.current)

        if (value.trim().length < 2) {
            onSearchResults?.([])
            onSearchLoading?.(false)
            return
        }

        onSearchLoading?.(true)
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/scan?query=${encodeURIComponent(value.trim())}`)
                const data = await res.json()
                onSearchResults?.(data.items || [])
            } catch {
                onSearchResults?.([])
            } finally {
                onSearchLoading?.(false)
            }
        }, 250)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            // Use e.currentTarget.value directly to get the most recent keyboard buffer
            // bypassing any React state synchronization lag for high-speed scanners
            const value = e.currentTarget.value.trim()
            if (value) {
                e.preventDefault()
                onScan(value)
                setManualInput('')
                // Clear the DOM value directly too
                e.currentTarget.value = ''
                onSearchResults?.([])
            }
        }
    }

    return (
        <div className="space-y-3">
            <div className="relative">
                <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
                <Input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={manualInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-11 h-14 text-lg focus-visible:ring-primary/40 bg-background/60 backdrop-blur-sm border-border/60 focus-visible:border-primary/50 transition-all duration-300 shadow-sm focus:shadow-md"
                    autoComplete="off"
                />

            </div>

            <p className="text-xs text-muted-foreground text-center">
                Silakan scan barcode barang pakai alat scanner fisik Anda
            </p>
        </div>
    )
}
