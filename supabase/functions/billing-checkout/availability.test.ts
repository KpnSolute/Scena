import { assertEquals } from "jsr:@std/assert@1";
import { decideAvailability, entitlementPlanCode } from "./availability.ts";

Deno.test("additional Personal uses Personal Free availability", () => {
  assertEquals(entitlementPlanCode("personal_additional"), "personal_free");
});

Deno.test("generally available and limited offerings can proceed", () => {
  assertEquals(decideAvailability({ availability: "generally_available" }), {
    ok: true,
    availability: "generally_available",
    note: null,
  });
  assertEquals(
    decideAvailability({
      availability: "limited",
      availability_note: "Reviewed onboarding.",
    }),
    {
      ok: true,
      availability: "limited",
      note: "Reviewed onboarding.",
    },
  );
});

Deno.test("pilot, waitlist, and unavailable offerings cannot proceed", () => {
  for (const availability of ["pilot", "waitlist", "unavailable"]) {
    assertEquals(decideAvailability({ availability }), {
      ok: false,
      code: "OFFERING_UNAVAILABLE",
      status: 400,
      message:
        "That Workspace offering is not currently available for Checkout.",
    });
  }
});

Deno.test("missing and malformed availability fail closed", () => {
  assertEquals(decideAvailability(null), {
    ok: false,
    code: "OFFERING_CONFIGURATION_INVALID",
    status: 503,
    message: "This offering has no valid availability configuration.",
  });
  assertEquals(decideAvailability({ availability: "unknown" }), {
    ok: false,
    code: "OFFERING_CONFIGURATION_INVALID",
    status: 503,
    message: "This offering has an invalid availability configuration.",
  });
});
