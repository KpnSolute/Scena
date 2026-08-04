import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { openWebhookSecret, sealWebhookSecret, verifyKpnSoluteWebhook } from "./kpnsoluteWebhooks.ts";

Deno.test("encrypts endpoint secrets and verifies Standard Webhooks signatures", async () => {
  const secretBytes = new TextEncoder().encode("01234567890123456789012345678901");
  const secret = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;
  const sealed = await sealWebhookSecret(secret, "test-encryption-key");
  assertNotEquals(sealed, secret);
  assertEquals(await openWebhookSecret(sealed, "test-encryption-key"), secret);

  const webhookId = "evt_test_123";
  const timestamp = Math.floor(Date.now() / 1000);
  const body = '{"specversion":"1.0","id":"source-1"}';
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${webhookId}.${timestamp}.${body}`)));
  const headers = new Headers({
    "webhook-id": webhookId,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${btoa(String.fromCharCode(...digest))}`,
  });
  assertEquals(await verifyKpnSoluteWebhook(secret, headers, body), { ok: true });
  assertEquals((await verifyKpnSoluteWebhook(secret, headers, `${body} `)).ok, false);
});
