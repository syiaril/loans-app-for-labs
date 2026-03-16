import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CardSkeleton, TableSkeleton } from '@/components/skeletons'
import { Table, TableHeader, TableRow, TableHead } from '@/components/ui/table'

export default function AdminDashboardLoading() {
    return (
        <div className="space-y-6">
            <div>
                <div className="h-8 w-64 bg-muted animate-pulse rounded-md mb-2" />
                <div className="h-4 w-96 bg-muted animate-pulse rounded-md" />
            </div>

            {/* Loan Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="backdrop-blur-xl bg-card/80 border-border/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-muted animate-pulse" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-6 w-16 bg-muted animate-pulse rounded-md" />
                                    <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Item Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="backdrop-blur-xl bg-card/80 border-border/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-muted animate-pulse" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-6 w-16 bg-muted animate-pulse rounded-md" />
                                    <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Logs Table Skeleton */}
                <Card className="backdrop-blur-xl bg-card/80 border-border/50 overflow-hidden">
                    <CardHeader>
                        <div className="h-6 w-48 bg-muted animate-pulse rounded-md" />
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Waktu</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableSkeleton columns={3} rows={5} />
                        </Table>
                    </CardContent>
                </Card>

                {/* Pending Users Skeleton */}
                <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                    <CardHeader>
                        <div className="h-6 w-48 bg-muted animate-pulse rounded-md" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20">
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 w-48 bg-muted animate-pulse rounded-md" />
                                        <div className="h-3 w-32 bg-muted animate-pulse rounded-md" />
                                    </div>
                                    <div className="h-8 w-24 bg-muted animate-pulse rounded-md shrink-0" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
