// Where the user was in each sidebar section: page, tab, filters and scroll position.
// Kept in memory for the browser tab's session and tied to the signed-in user, so nothing
// carries over to the next person, whichever way the previous one left.
const memory = new Map<string, unknown>();
let owner: string | null = null;

/** Call before anything reads the memory: a different user starts empty. */
export function bindNavMemory(userId: string) {
  if (owner !== userId) memory.clear();
  owner = userId;
}

export function remember(key: string, value: unknown) {
  memory.set(key, value);
}

export function recall<T>(key: string, fallback: T): T {
  return memory.has(key) ? (memory.get(key) as T) : fallback;
}

export function clearNavMemory() {
  memory.clear();
}

export function sectionOf(pathname: string, sections: string[]) {
  return sections.find((s) => pathname === s || pathname.startsWith(`${s}/`));
}

/** Leaving a section and coming back resumes it; pressing it again from inside goes to its start. */
export function sectionLink(section: string, pathname: string) {
  const inside = pathname === section || pathname.startsWith(`${section}/`);
  return inside ? section : recall(`nav:${section}`, section);
}
