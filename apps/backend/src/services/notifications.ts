import { Expo, type ExpoPushMessage } from 'expo-server-sdk'
import { prisma } from '../db/client.js'

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN })

export async function sendPushNotification(opts: {
  userId: string
  title: string
  body: string
  data?: Record<string, unknown>
}) {
  const tokens = await prisma.pushToken.findMany({
    where: { userId: opts.userId, platform: 'expo' },
    select: { token: true },
  })

  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t.token))
    .map((t) => ({
      to: t.token,
      title: opts.title,
      body: opts.body,
      data: opts.data,
      sound: 'default',
      priority: 'high',
    }))

  if (!messages.length) return

  const chunks = expo.chunkPushNotifications(messages)
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk)
      for (const receipt of receipts) {
        if (receipt.status === 'error') {
          console.error('Push error:', receipt.message, receipt.details)
        }
      }
    } catch (err) {
      console.error('Failed to send push chunk:', err)
    }
  }
}

/** Send a task-due reminder to the assigned user */
export async function sendTaskReminder(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { patient: true, assignedTo: true },
  })
  if (!task?.assignedTo) return

  await sendPushNotification({
    userId: task.assignedTo.id,
    title: `Task due: ${task.title}`,
    body: `Patient MR# ${task.patient.mrNumber} — ${task.priority} priority`,
    data: { type: 'task_reminder', taskId, patientId: task.patientId },
  })
}
