"use client";

import { useParams } from "next/navigation";
import QuotePanel from "../../../../components/scaffold/QuotePanel";

export default function QuotePage() {
  const params = useParams<{ id: string }>();
  return <QuotePanel projectId={params.id} />;
}
