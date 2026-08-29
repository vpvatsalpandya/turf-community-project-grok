import assert from "node:assert/strict";
import { test } from "node:test";
import { periodsOverlap } from "./availability.ts";
import { applyDiscount } from "./money.ts";
import { reliabilityBadge } from "./reliability.ts";

test("percent discount respects cap", () => {
  const r = applyDiscount({ pricePaise: 400000, type: "percent", value: 50, maxDiscountPaise: 40000 });
  assert.equal(r.discountPaise, 40000);
  assert.equal(r.duePaise, 360000);
});

test("overlap is half-open in time", () => {
  assert.equal(
    periodsOverlap("2026-08-26T08:00:00+05:30", "2026-08-26T09:00:00+05:30", "2026-08-26T09:00:00+05:30", "2026-08-26T10:00:00+05:30"),
    false,
  );
  assert.equal(
    periodsOverlap("2026-08-26T08:00:00+05:30", "2026-08-26T09:30:00+05:30", "2026-08-26T09:00:00+05:30", "2026-08-26T10:00:00+05:30"),
    true,
  );
});

test("reliability badges stay coarse", () => {
  assert.equal(reliabilityBadge({ lifetime_bookings: 1, lifetime_no_shows: 0, lifetime_late_cancels: 0 }), "New");
  assert.equal(reliabilityBadge({ lifetime_bookings: 8, lifetime_no_shows: 0, lifetime_late_cancels: 0 }), "Reliable");
  assert.equal(reliabilityBadge({ lifetime_bookings: 8, lifetime_no_shows: 2, lifetime_late_cancels: 0 }), "No-show risk");
  assert.equal(reliabilityBadge({ lifetime_bookings: 8, lifetime_no_shows: 0, lifetime_late_cancels: 1 }), "Has cancelled late");
});
