import { describe, expect, it } from "vitest";
import { areas } from "@/lib/areas";
import { eventsThisWeek, nextEventDate } from "@/lib/events";
import type { LocalEvent } from "@/lib/types";
import { parseEvent } from "@/lib/validation";

const weekly = (overrides: Partial<LocalEvent>): LocalEvent => ({ id: "e", title: "E", venue: "V", address: "A", day: "Wednesday", time: "7pm", category: "Night out", description: "d", detail: "", host: "h", ...overrides });

// Tuesday 3 November 2026, 1pm local time.
const tuesday = new Date(2026, 10, 3, 13, 0);

describe("nextEventDate", () => {
  it("finds the next matching weekday and time", () => {
    const date = nextEventDate(weekly({ day: "Friday", time: "8:30pm" }), tuesday);
    expect([date.getDate(), date.getHours(), date.getMinutes()]).toEqual([6, 20, 30]);
  });

  it("uses the fixed date for one-off events", () => {
    const date = nextEventDate(weekly({ day: "Saturday", date: "2026-10-31", time: "Evening" }), tuesday);
    expect([date.getMonth(), date.getDate()]).toEqual([9, 31]);
  });
});

describe("eventsThisWeek", () => {
  it("lists events from today to Sunday in date order", () => {
    const events = eventsThisWeek([
      weekly({ id: "sat", day: "Saturday" }),
      weekly({ id: "wed", day: "Wednesday" }),
      weekly({ id: "mon", day: "Monday" }),
    ], tuesday);
    expect(events.map((event) => event.id)).toEqual(["wed", "sat"]);
  });

  it("keeps tonight's event listed after it has started", () => {
    const evening = new Date(2026, 10, 3, 22, 0);
    expect(eventsThisWeek([weekly({ day: "Tuesday", time: "7pm" })], evening)).toHaveLength(1);
  });

  it("hides one-off events that have passed and shows ones this week", () => {
    const events = eventsThisWeek([
      weekly({ id: "halloween", date: "2026-10-31" }),
      weekly({ id: "bonfire", date: "2026-11-05" }),
    ], tuesday);
    expect(events.map((event) => event.id)).toEqual(["bonfire"]);
  });

  it("shows all seven weekly Nuneaton events on a Tuesday but not the past one-offs", () => {
    const ids = eventsThisWeek(areas.nuneaton.seedEvents, tuesday).map((event) => event.id);
    expect(ids).toHaveLength(7);
    expect(ids).not.toContain("george-eliot-halloween-2026");
  });

  it("keeps every seed event valid for the admin editor", () => {
    for (const event of areas.nuneaton.seedEvents) expect(parseEvent(event).ok, event.id).toBe(true);
  });
});
