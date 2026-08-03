/**
 * Looks up a required element by id and verifies its type at runtime —
 * fails loudly at module load instead of with a cryptic null access
 * later, when the markup and the code drift apart.
 */
export function byId<T extends HTMLElement>(id: string, ctor: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof ctor)) {
    throw new Error(`Missing element #${id}`);
  }
  return el;
}
