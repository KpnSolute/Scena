import { assertEquals } from "jsr:@std/assert@1";
import { capacityMetric } from "./capacity.ts";

Deno.test("capacity metric reports bounded remaining usage", () => {
  assertEquals(capacityMetric(3, 5), {
    used: 3,
    limit: 5,
    remaining: 2,
    unlimited: false,
  });
  assertEquals(capacityMetric(7, 5).remaining, 0);
});

Deno.test("capacity metric represents null limits as unlimited", () => {
  assertEquals(capacityMetric("12", null), {
    used: 12,
    limit: null,
    remaining: null,
    unlimited: true,
  });
});
