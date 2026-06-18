const CONTRIBUTOR_LAST_SEEN_PREFIX = "kolekto-contributor-notifications-seen";

export function getNotificationUserId(user: any): string | null {
  return user?.id || user?.user?.id || user?.email || null;
}

export function isContributorActivity(activity: any): boolean {
  const category = String(activity?.category || "").toLowerCase();
  const type = String(activity?.type || "").toLowerCase();

  if (category === "wallet" || type.startsWith("withdrawal")) return false;
  return true;
}

function storageKey(userId: string) {
  return `${CONTRIBUTOR_LAST_SEEN_PREFIX}:${userId}`;
}

export function getLastSeenContributorsAt(userId: string | null): number {
  if (!userId) return 0;
  return Number(localStorage.getItem(storageKey(userId)) || 0);
}

export function countUnseenContributorActivities(
  activities: any[],
  lastSeenAt: number,
): number {
  const seenIds = new Set<string>();
  let count = 0;

  for (const activity of activities || []) {
    if (!isContributorActivity(activity)) continue;

    const id = String(activity?.id || "");
    if (id && seenIds.has(id)) continue;

    const createdAt = new Date(activity?.created_at || 0).getTime();
    if (createdAt > lastSeenAt) {
      count += 1;
      if (id) seenIds.add(id);
    }
  }

  return count;
}

export function markContributorsSeen(userId: string | null): number {
  if (!userId) return 0;
  const seenAt = Date.now();
  localStorage.setItem(storageKey(userId), String(seenAt));
  return seenAt;
}
