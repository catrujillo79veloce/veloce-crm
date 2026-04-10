import { notFound } from "next/navigation"
import { getDeal } from "@/app/actions/deals"
import { getNotes } from "@/app/actions/notes"
import DealDetail from "./DealDetail"

interface DealPageProps {
  params: { id: string }
}

export default async function DealPage({ params }: DealPageProps) {
  const deal = await getDeal(params.id)

  if (!deal) {
    notFound()
  }

  const notes = await getNotes({ deal_id: params.id })

  return <DealDetail deal={deal} notes={notes} />
}
