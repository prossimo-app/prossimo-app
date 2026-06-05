import { observeTopicInputSchema } from "../realtime/topics.js";
import { publicProcedure, router } from "../trpc.js";
import { getCachedTopicPayload, observeTopic } from "../realtime/topics.js";

export const realtimeRouter = router({
  getTopic: publicProcedure
    .input(observeTopicInputSchema)
    .query(async ({ input }) => ({
      data: await getCachedTopicPayload(input.topic),
      topic: input.topic,
    })),
  observeTopic: publicProcedure
    .input(observeTopicInputSchema)
    .subscription(({ input, signal }) => {
      const fallbackAbortController = new AbortController();

      return observeTopic(
        input.topic,
        signal ?? fallbackAbortController.signal,
      );
    }),
});
