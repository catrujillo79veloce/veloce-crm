import { getDeals } from "@/app/actions/deals"
import { DealKanban } from "@/components/deals"

export default async function DealsPage() {
  const deals = await getDeals()

  return (
    <div className="space-y-4">
      <DealKanban initialDeals={deals} />
    </div>
  )
}
