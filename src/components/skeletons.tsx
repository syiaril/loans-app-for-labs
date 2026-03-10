'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { TableBody, TableCell, TableRow } from '@/components/ui/table'

interface TableSkeletonProps {
    columns: number
    rows?: number
}

export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
    return (
        <TableBody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <TableRow key={rowIdx}>
                    {Array.from({ length: columns }).map((_, colIdx) => (
                        <TableCell key={colIdx}>
                            <Skeleton className={`h-4 ${colIdx === 0 ? 'w-32' : 'w-20'}`} />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </TableBody>
    )
}

interface CardSkeletonProps {
    lines?: number
}

export function CardSkeleton({ lines = 4 }: CardSkeletonProps) {
    return (
        <div className="space-y-3 p-4">
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={`h-4 ${i === 0 ? 'w-3/4' : i === 1 ? 'w-1/2' : 'w-full'}`}
                />
            ))}
        </div>
    )
}
