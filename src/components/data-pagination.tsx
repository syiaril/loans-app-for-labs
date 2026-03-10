'use client'

import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination'

interface DataPaginationProps {
    page: number
    perPage: number
    totalItems?: number
    currentCount: number
    onPageChange: (page: number) => void
}

export default function DataPagination({
    page,
    perPage,
    totalItems,
    currentCount,
    onPageChange,
}: DataPaginationProps) {
    const hasMore = currentCount >= perPage
    const totalPages = totalItems ? Math.ceil(totalItems / perPage) : (hasMore ? page + 2 : page + 1)

    if (totalPages <= 1) return null

    // Generate page numbers to show
    function getPages(): (number | 'ellipsis')[] {
        const pages: (number | 'ellipsis')[] = []

        if (totalPages <= 7) {
            for (let i = 0; i < totalPages; i++) pages.push(i)
        } else {
            // Always show first page
            pages.push(0)

            if (page > 2) pages.push('ellipsis')

            // Pages around current
            const start = Math.max(1, page - 1)
            const end = Math.min(totalPages - 2, page + 1)

            for (let i = start; i <= end; i++) pages.push(i)

            if (page < totalPages - 3) pages.push('ellipsis')

            // Always show last page
            pages.push(totalPages - 1)
        }

        return pages
    }

    return (
        <Pagination className="mt-4">
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        text="Previous"
                        onClick={(e) => { e.preventDefault(); if (page > 0) onPageChange(page - 1) }}
                        className={page === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        href="#"
                    />
                </PaginationItem>

                {getPages().map((p, i) =>
                    p === 'ellipsis' ? (
                        <PaginationItem key={`e-${i}`}>
                            <PaginationEllipsis />
                        </PaginationItem>
                    ) : (
                        <PaginationItem key={p}>
                            <PaginationLink
                                isActive={page === p}
                                onClick={(e) => { e.preventDefault(); onPageChange(p) }}
                                className="cursor-pointer"
                                href="#"
                            >
                                {p + 1}
                            </PaginationLink>
                        </PaginationItem>
                    )
                )}

                <PaginationItem>
                    <PaginationNext
                        text="Next"
                        onClick={(e) => { e.preventDefault(); if (hasMore) onPageChange(page + 1) }}
                        className={!hasMore ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        href="#"
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    )
}
