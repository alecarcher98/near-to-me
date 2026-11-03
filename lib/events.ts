import type { LocalEvent } from "@/lib/types";

const dayNumbers: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
export const weekdays = Object.keys(dayNumbers);

export function nextEventDate(event: LocalEvent, now: Date) {
  const eventDate = event.date ? new Date(`${event.date}T00:00:00`) : new Date(now);
  eventDate.setHours(0, 0, 0, 0);
  if (!event.date) eventDate.setDate(now.getDate() + ((dayNumbers[event.day] - now.getDay() + 7) % 7));
  const match = event.time.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match) {
    let hours = Number(match[1]) % 12;
    if (match[3].toLowerCase() === "pm") hours += 12;
    eventDate.setHours(hours, Number(match[2] ?? 0));
  }
  return eventDate;
}

// Events from today until the end of Sunday; tonight's events stay listed all day.
export function eventsThisWeek(events: LocalEvent[], now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
  return events
    .map((event) => ({ ...event, eventDate: nextEventDate(event, now) }))
    .filter((event) => event.eventDate >= today && event.eventDate < nextMonday)
    .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
}
