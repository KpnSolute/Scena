export type CheckoutOfferingCode =
  | "personal_additional"
  | "plus"
  | "pro"
  | "max";
export type OfferingAvailability =
  | "generally_available"
  | "limited"
  | "pilot"
  | "waitlist"
  | "unavailable";

export type EntitlementAvailability = {
  availability: unknown;
  availability_note?: unknown;
};

export type AvailabilityDecision =
  | {
    ok: true;
    availability: "generally_available" | "limited";
    note: string | null;
  }
  | {
    ok: false;
    code: "OFFERING_UNAVAILABLE" | "OFFERING_CONFIGURATION_INVALID";
    status: 400 | 503;
    message: string;
  };

export function entitlementPlanCode(
  offeringCode: CheckoutOfferingCode,
): "personal_free" | "plus" | "pro" | "max" {
  return offeringCode === "personal_additional"
    ? "personal_free"
    : offeringCode;
}

export function decideAvailability(
  record: EntitlementAvailability | null,
): AvailabilityDecision {
  if (!record || typeof record.availability !== "string") {
    return {
      ok: false,
      code: "OFFERING_CONFIGURATION_INVALID",
      status: 503,
      message: "This offering has no valid availability configuration.",
    };
  }

  const availability = record.availability as OfferingAvailability;
  if (availability === "generally_available" || availability === "limited") {
    return {
      ok: true,
      availability,
      note: typeof record.availability_note === "string"
        ? record.availability_note
        : null,
    };
  }

  if (["pilot", "waitlist", "unavailable"].includes(availability)) {
    return {
      ok: false,
      code: "OFFERING_UNAVAILABLE",
      status: 400,
      message:
        "That Workspace offering is not currently available for Checkout.",
    };
  }

  return {
    ok: false,
    code: "OFFERING_CONFIGURATION_INVALID",
    status: 503,
    message: "This offering has an invalid availability configuration.",
  };
}
