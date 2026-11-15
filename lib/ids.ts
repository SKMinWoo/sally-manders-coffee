// Public order ids: what goes in the URL of an order's status page. Ten characters from an
// alphabet with no look-alikes (no 0/O, 1/I/L) is 31^10, about 8 × 10^14, so an id can't be guessed
// by walking through them the way a ticket number could.

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // 31 characters

export const PUBLIC_ID_LENGTH = 10;
export const PUBLIC_ID = new RegExp(`^[${ALPHABET}]{${PUBLIC_ID_LENGTH}}$`);

/** An id from any source of uniform numbers in [0, 1): seeded for the simulator. */
export function publicIdFrom(next: () => number): string {
  let id = "";
  for (let i = 0; i < PUBLIC_ID_LENGTH; i++) id += ALPHABET[Math.floor(next() * ALPHABET.length)];
  return id;
}

/** An id for a visitor's order, from the platform's cryptographic random source. */
export function randomPublicId(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(PUBLIC_ID_LENGTH));
  let i = 0;
  return publicIdFrom(() => bytes[i++]! / 2 ** 32);
}
