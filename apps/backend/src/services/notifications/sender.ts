import { prisma } from '../../db/client.js'

export async function sendNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  patientId?: string,
  resourceId?: string,
) {
  // 1. Persist to DB
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, patientId: patientId ?? null, resourceId: resourceId ?? null },
  })

  // 2. Fire push notification if an Expo token exists
  try {
    const pushToken = await prisma.pushToken.findFirst({
      where: { userId, platform: 'expo' },
      orderBy: { updatedAt: 'desc' },
    })

    if (pushToken) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: pushToken.token,
          title,
          body,
          data: { notificationId: notification.id, type, patientId, resourceId },
          sound: 'default',
          priority: type === 'CRITICAL_LAB' ? 'high' : 'normal',
        }),
      })
    }
  } catch {
    // Push delivery failures are non-critical — DB record already exists
  }

  return notification
}
