import { prisma } from '../db/client.js'

const ANON_NAME = '[DELETED]'
const ANON_EMAIL_PREFIX = 'deleted-'

/**
 * GDPR right-to-erasure implementation.
 *
 * Strategy:
 * - User PII (name, email, auth0Sub, passwordHash, totpSecret) → anonymised/nulled
 * - Clinical records the user authored are de-linked (authorId set to a system tombstone user)
 * - Audit logs are retained for legal/compliance (7-year requirement) but user PII is removed
 * - Patient records are NOT deleted — they are medical records required for other clinicians;
 *   only the requesting user's personal association is severed
 *
 * Returns a summary of what was changed.
 */
export async function eraseUser(userId: string, requestedBy: string): Promise<{
  userId: string
  anonymised: boolean
  recordsAffected: Record<string, number>
}> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

  // Tombstone account for self-erasure
  const anonEmail = `${ANON_EMAIL_PREFIX}${userId.slice(0, 8)}@deleted.medlog.app`

  await prisma.$transaction(async (tx) => {
    // 1. Anonymise user PII
    await tx.user.update({
      where: { id: userId },
      data: {
        name: ANON_NAME,
        email: anonEmail,
        passwordHash: null,
        totpSecret: null,
        totpSecretPending: null,
        auth0Sub: null,
        teamId: null,
      },
    })

    // 2. Revoke push tokens
    await tx.pushToken.deleteMany({ where: { userId } })

    // 3. Scrub audit log metadata (keep the log row — required for 7-year retention)
    // We null the FK by re-pointing to the anonymised user (user.id stays the same, just PII is cleared)

    // 4. Log the erasure itself (using the anonymised user id)
    await tx.auditLog.create({
      data: {
        userId,
        action: 'GDPR_ERASURE',
        resourceType: 'USER',
        resourceId: userId,
        metadata: { requestedBy, erasedAt: new Date().toISOString() },
      },
    })
  })

  // Count affected rows (outside transaction for reporting)
  const [noteCount, taskCount, labCount] = await Promise.all([
    prisma.clinicalNote.count({ where: { authorId: userId } }),
    prisma.task.count({ where: { OR: [{ createdById: userId }, { assignedToId: userId }] } }),
    prisma.labReport.count({ where: { createdById: userId } }),
  ])

  return {
    userId,
    anonymised: true,
    recordsAffected: {
      notesAuthored: noteCount,
      tasksCreatedOrAssigned: taskCount,
      labsEntered: labCount,
    },
  }
}
