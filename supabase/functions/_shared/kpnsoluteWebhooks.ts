const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function signingSecretBytes(secret: string): Uint8Array {
  return base64ToBytes(secret.startsWith("whsec_") ? secret.slice(6) : secret);
}

async function encryptionKey(secret: string, usages: Array<"encrypt" | "decrypt">) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, usages);
}

export async function sealWebhookSecret(secret: string, encryptionSecret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(encryptionSecret, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(secret)));
  return `enc:v1:${bytesToBase64(iv)}:${bytesToBase64(encrypted)}`;
}

export async function openWebhookSecret(value: string, encryptionSecret: string): Promise<string> {
  const [prefix, version, ivValue, encryptedValue] = value.split(":");
  if (prefix !== "enc" || version !== "v1" || !ivValue || !encryptedValue) throw new Error("Invalid encrypted webhook secret");
  const key = await encryptionKey(encryptionSecret, ["decrypt"]);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivValue).buffer as ArrayBuffer },
    key,
    base64ToBytes(encryptedValue).buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(clear);
}

export async function verifyKpnSoluteWebhook(secret: string, headers: Headers, rawBody: string, toleranceSeconds = 300) {
  const id = headers.get("webhook-id") ?? "";
  const timestampText = headers.get("webhook-timestamp") ?? "";
  const signatures = (headers.get("webhook-signature") ?? "").split(" ");
  if (!id || id.includes(".") || !/^\d+$/.test(timestampText)) return { ok: false, reason: "invalid webhook metadata" };
  if (Math.abs(Date.now() / 1000 - Number(timestampText)) > toleranceSeconds) return { ok: false, reason: "timestamp outside replay window" };
  const key = await crypto.subtle.importKey("raw", signingSecretBytes(secret).buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${id}.${timestampText}.${rawBody}`)));
  for (const candidate of signatures) {
    const match = /^v1,([A-Za-z0-9+/=]+)$/.exec(candidate);
    if (!match) continue;
    const actual = base64ToBytes(match[1]);
    if (actual.length !== expected.length) continue;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
    if (difference === 0) return { ok: true };
  }
  return { ok: false, reason: "signature mismatch" };
}
