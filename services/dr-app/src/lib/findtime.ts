import { z } from "zod";

export const findTimeSlotSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().trim().max(160).optional().nullable()
});

export const findTimeParticipantSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  availableSlotIds: z.array(z.string().min(1)).default([])
});

export const findTimeMatchRequestSchema = z.object({
  title: z.string().trim().max(160).optional().default("Availability session"),
  timezone: z.string().trim().max(120).optional().default("Europe/Berlin"),
  slots: z.array(findTimeSlotSchema).min(1),
  participants: z.array(findTimeParticipantSchema).min(1)
});

export type FindTimeSlot = z.infer<typeof findTimeSlotSchema>;
export type FindTimeParticipant = z.infer<typeof findTimeParticipantSchema>;
export type FindTimeMatchRequest = z.infer<typeof findTimeMatchRequestSchema>;

export type FindTimeScoredSlot = FindTimeSlot & {
  availableCount: number;
  unavailableCount: number;
  availableParticipantIds: string[];
  unavailableParticipantIds: string[];
  score: number;
};

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getSlotDurationMinutes(slot: FindTimeSlot) {
  return Math.max(0, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
}

export function labelSlot(slot: FindTimeSlot) {
  return `${slot.date} · ${slot.startTime}-${slot.endTime}`;
}

export function scoreFindTimeRequest(input: FindTimeMatchRequest) {
  const participantMap = new Map(input.participants.map((participant) => [participant.id, participant]));

  const scoredSlots = input.slots
    .map<FindTimeScoredSlot>((slot) => {
      const availableParticipantIds = input.participants
        .filter((participant) => participant.availableSlotIds.includes(slot.id))
        .map((participant) => participant.id);

      const unavailableParticipantIds = input.participants
        .filter((participant) => !participant.availableSlotIds.includes(slot.id))
        .map((participant) => participant.id);

      const availableCount = availableParticipantIds.length;
      const unavailableCount = unavailableParticipantIds.length;
      const durationMinutes = getSlotDurationMinutes(slot);
      const score = availableCount * 100 - unavailableCount * 25 + Math.min(durationMinutes, 180);

      return {
        ...slot,
        availableCount,
        unavailableCount,
        availableParticipantIds,
        unavailableParticipantIds,
        score
      };
    })
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const bestSlots = scoredSlots.slice(0, 3);

  return {
    title: input.title,
    timezone: input.timezone,
    slots: scoredSlots,
    bestSlots,
    participantDirectory: Object.fromEntries(
      input.participants.map((participant) => [
        participant.id,
        {
          id: participant.id,
          name: participant.name,
          availableCount: participant.availableSlotIds.length
        }
      ])
    ),
    summary: {
      participantCount: input.participants.length,
      slotCount: input.slots.length,
      strongestConsensus:
        bestSlots[0]?.availableParticipantIds.map((participantId) => participantMap.get(participantId)?.name ?? participantId) ??
        [],
      topScore: bestSlots[0]?.score ?? 0
    }
  };
}

export function buildFindTimeDemo() {
  const slots: FindTimeSlot[] = [
    { id: "slot-1", date: "2026-03-12", startTime: "18:00", endTime: "19:30", label: "Thursday evening" },
    { id: "slot-2", date: "2026-03-13", startTime: "12:30", endTime: "14:00", label: "Friday lunch" },
    { id: "slot-3", date: "2026-03-14", startTime: "10:00", endTime: "11:30", label: "Saturday morning" }
  ];

  const participants: FindTimeParticipant[] = [
    { id: "p-1", name: "Alessandro", availableSlotIds: ["slot-1", "slot-3"] },
    { id: "p-2", name: "Maria", availableSlotIds: ["slot-1", "slot-2"] },
    { id: "p-3", name: "Giulia", availableSlotIds: ["slot-2", "slot-3"] },
    { id: "p-4", name: "Carlo", availableSlotIds: ["slot-1", "slot-2", "slot-3"] }
  ];

  return {
    title: "Citizen assembly scheduling",
    timezone: "Europe/Berlin",
    slots,
    participants
  };
}
