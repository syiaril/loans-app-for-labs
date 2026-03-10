'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Camera, CameraOff, Keyboard } from 'lucide-react'
import { toast } from 'sonner'

interface BarcodeScannerProps {
    onScan: (barcode: string) => void
    placeholder?: string
    autoFocus?: boolean
}

export default function BarcodeScanner({ onScan, placeholder = 'Scan atau ketik barcode...', autoFocus = true }: BarcodeScannerProps) {
    const [manualInput, setManualInput] = useState('')
    const [cameraActive, setCameraActive] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const videoRef = useRef<HTMLDivElement>(null)
    const scannerRef = useRef<unknown>(null)

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
        if (e.key === 'Enter' && manualInput.trim()) {
            e.preventDefault()
            onScan(manualInput.trim())
            setManualInput('')
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder={placeholder}
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pl-10 h-12 text-lg"
                    />
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
