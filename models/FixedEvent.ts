import prisma from "@/lib/prisma";
import { createPrismaModel } from "@/models/_base";

export interface IRecurrence {
  type: "once" | "daily" | "weekly" | "custom";
  days?: ("monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday")[];
  startDate: Date;
  endDate?: Date;
}

export interface IFixedEvent {
  id: string;
  userId: string;
  title: string;
  type: "class" | "work" | "gym" | "meeting" | "personal" | "other";
  startTime: string;
  endTime: string;
  recurrence: IRecurrence;
  location?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const baseModel = createPrismaModel<IFixedEvent>(prisma.fixedEvent, ["recurrence"]);

export const FixedEvent = {
  ...baseModel,
  getDuration(event: Pick<IFixedEvent, "startTime" | "endTime">) {
    const [startHour, startMinute] = event.startTime.split(":").map(Number);
    const [endHour, endMinute] = event.endTime.split(":").map(Number);
    return endHour * 60 + endMinute - (startHour * 60 + startMinute);
  },
  isActiveOnDate(event: IFixedEvent, date: Date) {
    if (!event.active) return false;

    const recurrence = {
      ...event.recurrence,
      startDate: new Date(event.recurrence.startDate),
      endDate: event.recurrence.endDate ? new Date(event.recurrence.endDate) : undefined,
    };

    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ] as const;
    const dayOfWeek = dayNames[date.getDay()];

    if (recurrence.type === "once") {
      return date.toDateString() === recurrence.startDate.toDateString();
    }

    if (recurrence.type === "daily") {
      return date >= recurrence.startDate && (!recurrence.endDate || date <= recurrence.endDate);
    }

    if (recurrence.type === "weekly") {
      return !!recurrence.days?.includes(dayOfWeek) &&
        date >= recurrence.startDate &&
        (!recurrence.endDate || date <= recurrence.endDate);
    }

    return false;
  },
};
