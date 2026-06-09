import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { isVisibleStrikeNotice } from "~/news/strike-notices";
import { trpc } from "~/utils/api";

export type NewsData = RouterOutputs["news"]["getLatest"];
export type GlobalNewsItem = NewsData["globalNews"][number];

export function useLatestNews() {
  const newsQuery = useQuery({
    ...trpc.news.getLatest.queryOptions({}),
    staleTime: 5 * 60 * 1000,
  });

  return {
    globalNews: newsQuery.data?.globalNews ?? [],
    isLoading: newsQuery.isLoading,
    strikes:
      newsQuery.data?.strikes.filter((strike) =>
        isVisibleStrikeNotice(strike),
      ) ?? [],
  };
}
