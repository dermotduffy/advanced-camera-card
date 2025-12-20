import { z } from 'zod';

const go2RTCProducerSchema = z.object({
  medias: z.array(z.string()).optional(),
});

/**
 * Zod schema for Go2RTC stream information. Schema only covers the minimum
 * required by the card.
 * Response from `/api/streams?src=${stream}&video=all&audio=all&microphone`
 */
export const go2RTCStreamInfoSchema = z.object({
  producers: z.array(go2RTCProducerSchema).optional(),
});

export type Go2RTCStreamInfo = z.infer<typeof go2RTCStreamInfoSchema>;
