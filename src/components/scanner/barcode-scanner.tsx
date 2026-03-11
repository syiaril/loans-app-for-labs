'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Camera, CameraOff, Keyboard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
    const [cameraActive, setCameraActive] = useState(false)
    const [cameraLoading, setCameraLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus()
        }

        // Catch global keystrokes for the scanner
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Ignore if already in our input or any other input/editable
            const activeElement = document.activeElement as HTMLElement
            const isInput = activeElement.tagName === 'INPUT' || 
                            activeElement.tagName === 'TEXTAREA' || 
                            activeElement.isContentEditable

            if (isInput && activeElement !== inputRef.current) return

            // If we're not focused, focus us
            if (activeElement !== inputRef.current && inputRef.current) {
                // Ignore function keys, control keys, tabs, etc.
                if (e.key.length === 1 || e.key === 'Enter') {
                    inputRef.current.focus()
                }
            }
        }

        window.addEventListener('keydown', handleGlobalKeyDown)
        return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [autoFocus])

    useEffect(() => {
        return () => {
            stopCamera()
        }
    }, [])

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

    async function startCamera() {
        setCameraLoading(true)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            })
            streamRef.current = stream

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play()
            }

            setCameraActive(true)

            // Try BarcodeDetector API
            if ('BarcodeDetector' in window) {
                // @ts-expect-error - BarcodeDetector is not yet in all TS environments
                const detector = new BarcodeDetector({
                    formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e']
                })
                scanIntervalRef.current = setInterval(async () => {
                    if (!videoRef.current || videoRef.current.readyState !== 4) return
                    try {
                        const barcodes = await detector.detect(videoRef.current)
                        if (barcodes.length > 0) {
                            const code = barcodes[0].rawValue
                            toast.success(`Barcode terdeteksi: ${code}`)
                            onScan(code)
                            stopCamera()
                        }
                    } catch { }
                }, 200)
            } else {
                toast.info('Browser tidak mendukung BarcodeDetector. Silakan ketik kode manual.')
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : ''
            if (msg.includes('Permission') || msg.includes('NotAllowed')) {
                toast.error('Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.')
            } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
                toast.error('Kamera tidak ditemukan pada perangkat ini.')
            } else {
                toast.error('Gagal mengakses kamera: ' + msg)
            }
        } finally {
            setCameraLoading(false)
        }
    }

    function stopCamera() {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current)
            scanIntervalRef.current = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
        setCameraActive(false)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter' && manualInput.trim()) {
            e.preventDefault()
            onScan(manualInput.trim())
            setManualInput('')
            onSearchResults?.([])
        }
    }

    return (
        <div className="space-y-3">
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
                        className="pl-10 h-12 text-lg focus-visible:ring-primary/50"
                        autoComplete="off"
                    />
                    {autoFocus && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-medium text-emerald-500/80 uppercase tracking-wider hidden sm:inline">Siap Scan</span>
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
            </div>

            {/* Camera Preview — Persistent element to avoid losing stream */}
            <div
                className={cn(
                    "relative rounded-xl overflow-hidden border border-border bg-black transition-all duration-300",
                    cameraActive ? "h-[300px] opacity-100 mb-2" : "h-0 opacity-0 overflow-hidden border-none"
                )}
            >
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                    autoPlay
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-24 border-2 border-primary/50 rounded-lg" />
                </div>
                <div className="absolute top-2 right-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 bg-black/50 backdrop-blur-md border-white/10 text-white"
                        onClick={() => { stopCamera(); setTimeout(startCamera, 100); }}
                    >
                        Muat Ulang
                    </Button>
                </div>
            </div>

            {!cameraActive && (
                <p className="text-xs text-muted-foreground text-center">
                    Scan barcode otomatis saat Enter • Ketik nama barang untuk cari realtime 📷
                </p>
            )}

            {cameraActive && (
                <p className="text-xs text-primary font-medium text-center animate-pulse">
                    Kamera aktif. Silakan arahkan barcode ke kotak di atas.
                </p>
            )}
        </div>
    )
}
