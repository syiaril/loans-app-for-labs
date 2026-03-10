'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Camera, CameraOff, Keyboard, Package, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ITEM_STATUS_LABELS, ITEM_STATUS_COLORS } from '@/lib/utils'

interface SuggestItem {
    id: number
    name: string
    code: string
    barcode: string
    status: string
    category?: { name: string }
}

interface BarcodeScannerProps {
    onScan: (barcode: string) => void
    placeholder?: string
    autoFocus?: boolean
}

export default function BarcodeScanner({ onScan, placeholder = 'Scan atau ketik barcode...', autoFocus = true }: BarcodeScannerProps) {
    const [manualInput, setManualInput] = useState('')
    const [cameraActive, setCameraActive] = useState(false)
    const [suggestions, setSuggestions] = useState<SuggestItem[]>([])
    const [suggestLoading, setSuggestLoading] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const videoRef = useRef<HTMLDivElement>(null)
    const scannerRef = useRef<unknown>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus()
        }
    }, [autoFocus])

    useEffect(() => {
        return () => {
            stopCamera()
        }
    }, [])

    // Close suggestions when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Live search with debounce
    const fetchSuggestions = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSuggestions([])
            setShowSuggestions(false)
            return
        }

        setSuggestLoading(true)
        try {
            const res = await fetch(`/api/scan?query=${encodeURIComponent(query)}`)
            const data = await res.json()
            if (data.items && data.items.length > 0) {
                setSuggestions(data.items)
                setShowSuggestions(true)
                setSelectedIndex(-1)
            } else {
                setSuggestions([])
                setShowSuggestions(false)
            }
        } catch {
            setSuggestions([])
        } finally {
            setSuggestLoading(false)
        }
    }, [])

    function handleInputChange(value: string) {
        setManualInput(value)

        // Debounce API calls
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(value.trim())
        }, 300)
    }

    function handleSelectSuggestion(item: SuggestItem) {
        setManualInput('')
        setShowSuggestions(false)
        setSuggestions([])
        onScan(item.barcode)
    }

    async function startCamera() {
        try {
            const { Html5Qrcode } = await import('html5-qrcode')

            if (!videoRef.current) return

            const scannerId = 'barcode-scanner-video'
            let scannerDiv = document.getElementById(scannerId)
            if (!scannerDiv) {
                scannerDiv = document.createElement('div')
                scannerDiv.id = scannerId
                videoRef.current.appendChild(scannerDiv)
            }

            const scanner = new Html5Qrcode(scannerId)
            scannerRef.current = scanner

            await scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 100 } },
                (decodedText) => {
                    onScan(decodedText)
                    toast.success(`Barcode terdeteksi: ${decodedText}`)
                },
                () => { } // ignore errors during scanning
            )

            setCameraActive(true)
        } catch (err) {
            toast.error('Gagal mengakses kamera: ' + (err instanceof Error ? err.message : 'Unknown error'))
        }
    }

    async function stopCamera() {
        try {
            if (scannerRef.current) {
                const scanner = scannerRef.current as { stop: () => Promise<void>; clear: () => void }
                await scanner.stop()
                scanner.clear()
                scannerRef.current = null
            }
            setCameraActive(false)
        } catch {
            // Ignore cleanup errors
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0))
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1))
                return
            }
            if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault()
                handleSelectSuggestion(suggestions[selectedIndex])
                return
            }
            if (e.key === 'Escape') {
                setShowSuggestions(false)
                return
            }
        }

        if (e.key === 'Enter' && manualInput.trim()) {
            e.preventDefault()
            onScan(manualInput.trim())
            setManualInput('')
            setShowSuggestions(false)
        }
    }

    return (
        <div className="space-y-3" ref={wrapperRef}>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder={placeholder}
                        value={manualInput}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            if (suggestions.length > 0) setShowSuggestions(true)
                        }}
                        className="pl-10 h-12 text-lg"
                        autoComplete="off"
                    />

                    {/* Autocomplete Suggestions Dropdown */}
                    {showSuggestions && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            {suggestLoading && (
                                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Mencari...
                                </div>
                            )}
                            <div className="max-h-64 overflow-y-auto">
                                {suggestions.map((item, index) => (
                                    <button
                                        key={item.id}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${index === selectedIndex
                                                ? 'bg-primary/10'
                                                : 'hover:bg-muted/50'
                                            } ${index !== suggestions.length - 1 ? 'border-b border-border/30' : ''}`}
                                        onClick={() => handleSelectSuggestion(item)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.status === 'borrowed'
                                                ? 'bg-yellow-500/10'
                                                : item.status === 'available'
                                                    ? 'bg-emerald-500/10'
                                                    : 'bg-muted'
                                            }`}>
                                            {item.status === 'borrowed' ? (
                                                <Clock className="w-4 h-4 text-yellow-400" />
                                            ) : (
                                                <Package className="w-4 h-4 text-emerald-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {item.code} • {item.category?.name || ''}
                                            </p>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={`shrink-0 text-[10px] ${ITEM_STATUS_COLORS[item.status as keyof typeof ITEM_STATUS_COLORS] || ''}`}
                                        >
                                            {ITEM_STATUS_LABELS[item.status as keyof typeof ITEM_STATUS_LABELS] || item.status}
                                        </Badge>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <Button
                    type="button"
                    variant={cameraActive ? 'destructive' : 'outline'}
                    size="icon"
                    className="h-12 w-12"
                    onClick={cameraActive ? stopCamera : startCamera}
                >
                    {cameraActive ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                </Button>
                {manualInput && (
                    <Button
                        type="button"
                        className="h-12"
                        onClick={() => {
                            onScan(manualInput.trim())
                            setManualInput('')
                            setShowSuggestions(false)
                        }}
                    >
                        Cari
                    </Button>
                )}
            </div>

            {cameraActive && (
                <div ref={videoRef} className="relative rounded-xl overflow-hidden border border-border bg-black aspect-video max-h-64">
                </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
                Gunakan scanner hardware (auto-submit saat Enter) atau aktifkan kamera untuk scan
            </p>
        </div>
    )
}
