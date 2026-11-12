import { revalidatePath as nextRevalidatePath } from "next/cache";

/**
 * Safe wrapper around Next.js revalidatePath that succeeds within Next.js requests
 * and safely no-ops when invoked from standalone CLI test scripts or seed scripts.
 */
export function safeRevalidatePath(path: string, type?: "layout" | "page") {
  try {
    if (type) {
      nextRevalidatePath(path, type);
    } else {
      nextRevalidatePath(path);
    }
  } catch {
    // Outside Next.js static generation store (e.g. standalone CLI scripts/tests)
  }
}
