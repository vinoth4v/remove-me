/**
 * Date arithmetic for the request workflow and the weekly verification cron.
 * Pure functions so the cron's decisions are unit-testable without a clock
 * or a database.
 */

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  const day = result.getUTCDate()
  result.setUTCMonth(result.getUTCMonth() + months)
  // 31 Jan + 1 month must be end of Feb, not 2/3 Mar.
  if (result.getUTCDate() < day) result.setUTCDate(0)
  return result
}

/** Art. 12(3) DSGVO: one month from the day the request was sent. */
export function deadlineFor(sentAt: Date): Date {
  return addMonths(sentAt, 1)
}

/** A sent request whose deadline has passed without a logged reply. */
export function isOverdue(sentStatus: string, deadlineAt: Date | null, now: Date): boolean {
  return sentStatus === "sent" && deadlineAt !== null && deadlineAt.getTime() < now.getTime()
}

/**
 * A confirmed erasure older than six months is due a re-check — re-listing
 * after deletion is the norm, not the exception.
 */
export function erasureRecheckDue(
  type: string,
  status: string,
  replyAt: Date | null,
  now: Date,
): boolean {
  return (
    type === "art17" &&
    status === "satisfied" &&
    replyAt !== null &&
    addMonths(replyAt, 6).getTime() < now.getTime()
  )
}

/** A completed registry action whose renewal interval has elapsed. */
export function renewalDue(
  status: string,
  renewalMonths: number | null,
  lastActionAt: Date | null,
  now: Date,
): boolean {
  return (
    status === "done" &&
    renewalMonths !== null &&
    lastActionAt !== null &&
    addMonths(lastActionAt, renewalMonths).getTime() < now.getTime()
  )
}
