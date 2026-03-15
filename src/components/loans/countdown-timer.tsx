'use client'

import { useState, useEffect } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CountdownTimerProps {
  dueDate: string
  status: string
  className?: string
}

export default function CountdownTimer({ dueDate, status, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [isOverdue, setIsOverdue] = useState(false)

  useEffect(() => {
    if (status === 'returned' || status === 'cancelled') return

    const timer = setInterval(() => {
      const now = new Date().getTime()
      let targetDate = new Date(dueDate)
      
      // If parsing failed or resulted in Invalid Date, try to fix it
      if (isNaN(targetDate.getTime())) {
        targetDate = new Date(dueDate.replace(' ', 'T'))
      }

      // If it's just a date string (YYYY-MM-DD), it might be parsed as UTC 00:00
      // which can be in the past for some timezones. 
      // We should check if the string has a time component.
      const hasTime = dueDate.includes('T') || dueDate.includes(':') || dueDate.includes(' ')
      
      let target = targetDate.getTime()
      
      // If it's just a date, let's treat it as the very end of that day in local time
      // to avoid immediate overdue due to UTC parsing.
      if (!hasTime && !isNaN(target)) {
        targetDate.setHours(23, 59, 59, 999)
        target = targetDate.getTime()
      }

      const distance = target - now
      
      console.log('Countdown DEBUG:', { 
        dueDate, 
        hasTime, 
        target: new Date(target).toLocaleString(), 
        now: new Date(now).toLocaleString(), 
        distance 
      })

      if (distance <= 0) {
        setTimeLeft('TERLAMBAT')
        setIsOverdue(true)
        setIsUrgent(false)
        clearInterval(timer)
        return
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      setTimeLeft(`${hours}j ${minutes}m ${seconds}s`)
      
      // Urgent if less than 1 hour
      setIsUrgent(distance < 1000 * 60 * 60)
      setIsOverdue(false)
    }, 1000)

    return () => clearInterval(timer)
  }, [dueDate, status])

  if (status === 'returned' || status === 'cancelled') return null

  return (
    <div className={cn(
      "flex items-center gap-1.5 font-mono font-bold text-[10px] tracking-tight px-2 py-0.5 rounded-md border animate-in fade-in duration-300",
      isOverdue ? "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse" : 
      isUrgent ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : 
      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      className
    )}>
      {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      <span>{timeLeft || '--:--:--'}</span>
    </div>
  )
}
