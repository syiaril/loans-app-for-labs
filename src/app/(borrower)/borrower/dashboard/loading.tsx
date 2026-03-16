import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CardSkeleton } from '@/components/skeletons'

export default function DashboardLoading() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="h-8 w-64 bg-muted animate-pulse rounded-md" />
                <div className="h-4 w-96 bg-muted animate-pulse rounded-md" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardHeader>
                    <div className="h-6 w-48 bg-muted animate-pulse rounded-md" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="p-4 rounded-xl bg-muted/30 border border-border/30">
                                <CardSkeleton lines={3} />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
