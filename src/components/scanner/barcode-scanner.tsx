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
    const [cameraLoading, setCameraLoading] = useState(false)
    const [suggestions, setSuggestions] = useState<SuggestItem[]>([])
    const [suggestLoading, setSuggestLoading] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const scannerRef = useRef<any>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus()
        }
    }, [autoFocus])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                try {
                    scannerRef.current.stop().catch(() => { })
                } catch { }
                scannerRef.current = null
            }
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
        setCameraLoading(true)
        try {
            // Clean up any existing scanner first
            if (scannerRef.current) {
                try {
                    await scannerRef.current.stop()
                } catch { }
                scannerRef.current = null
            }

            // Clean up any existing scanner div
            const existingDiv = document.getElementById('barcode-reader')
            if (existingDiv) {
                existingDiv.innerHTML = ''
            }

            const { Html5Qrcode } = await import('html5-qrcode')
            const scanner = new Html5Qrcode('barcode-reader')
            scannerRef.current = scanner

            const cameras = await Html5Qrcode.getCameras()
            if (!cameras || cameras.length === 0) {
                toast.error('Tidak ada kamera yang tersedia')
                setCameraLoading(false)
                return
            }

            // Prefer back camera
            const backCamera = cameras.find(c =>
                c.label.toLowerCase().includes('back') ||
                c.label.toLowerCase().includes('belakang') ||
                c.label.toLowerCase().includes('environment')
            )
            const cameraId = backCamera ? backCamera.id : cameras[cameras.length - 1].id

            await scanner.start(
                cameraId,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 150 },
                    aspectRatio: 1.777,
                },
                (decodedText) => {
                    onScan(decodedText)
                    toast.success(`Barcode terdeteksi: ${decodedText}`)
                    // Auto-stop after successful scan
                    stopCamera()
                },
                () => { } // ignore scan errors
            )

            setCameraActive(true)
        } catch (err: any) {
            const errorMsg = err?.message || 'Tidak bisa mengakses kamera'
            if (errorMsg.includes('Permission denied') || errorMsg.includes('NotAllowedError')) {
                toast.error('Izin kamera ditolak. Silakan izinkan akses kamera di browser.')
            } else if (errorMsg.includes('NotFoundError')) {
                toast.error('Kamera tidak ditemukan pada perangkat ini.')
            } else {
                toast.error('Gagal mengakses kamera: ' + errorMsg)
            }
        } finally {
            setCameraLoading(false)
        }
    }

    async function stopCamera() {
        try {
            if (scannerRef.current) {
                const isScanning = scannerRef.current.isScanning
                if (isScanning) {
                    await scannerRef.current.stop()
                }
                scannerRef.current = null
            }
        } catch {
            scannerRef.current = null
        }
        setCameraActive(false)
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
                    disabled={cameraLoading}
                >
                    {cameraLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : cameraActive ? (
                        <CameraOff className="w-5 h-5" />
                    ) : (
                        <Camera className="w-5 h-5" />
                    )}
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

            {/* Camera Scanner Area */}
            <div
                id="barcode-reader"
                className={`rounded-xl overflow-hidden border border-border bg-black ${cameraActive ? 'block' : 'hidden'}`}
                style={{ maxHeight: '300px' }}
            />

            <p className="text-xs text-muted-foreground text-center">
                Gunakan scanner hardware (auto-submit saat Enter) atau aktifkan kamera 📷
            </p>
        </div>
    )
}
