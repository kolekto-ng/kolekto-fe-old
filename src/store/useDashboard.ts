import { useMemo } from "react";
import { Transaction, Collection, Contribution } from "@/types";

interface UseDashboardPaymentsProps {
  contributions: Contribution[];
  collections: Collection[];
  userId: string;
}

export function useDashboardPayments({
  contributions,
  collections,
  userId,
}: UseDashboardPaymentsProps) {
  console.log(collections, "collectionsin usedahsboard");

  const recentPayments: Transaction[] = useMemo(
    () =>
      contributions?.map((contribution) => ({
        id: contribution.id,
        user_id: userId,
        collection_id: contribution.collection_id,
        contribution_id: contribution.id,
        withdrawal_id: null,
        amount: contribution.amount,
        created_at: contribution.created_at,
        description: `Contribution from ${contribution.contributor_name}`,
        type: "contribution",
        collections: {
          title:
            collections.find((c) => c.id === contribution.collection_id)
              ?.title || "Unknown",
        },
      })) || [],
    [contributions, collections, userId]
  );

  return {
    recentPayments,
    isLoading: false,
    error: null,
  };
}
