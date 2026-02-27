import { prisma } from './prisma';
import { initializeFCM, logPushNotification, updatePushNotificationLog } from './fcm-service';
import type { NotificationSource, NotificationType } from './fcm-service';
import * as admin from 'firebase-admin';

const BATCH_SIZE = 5;
const PROGRESS_UPDATE_INTERVAL = 5;

/**
 * Process push notification sending in the background.
 * Designed to be called from after() or cron resume.
 *
 * Sends notifications in small batches to avoid overwhelming the server.
 * Updates progress in the database so the frontend can poll for real-time updates.
 * Supports resuming from where it left off after crashes.
 */
export async function processNotificationSend(notificationId: string): Promise<void> {
  try {
    // Atomic lock: only transition from 'queued' to 'sending'
    const updated = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        sendStatus: { in: ['queued'] },
      },
      data: {
        sendStatus: 'sending',
        sendStartedAt: new Date(),
        sendProgress: 0,
        successCount: 0,
        failureCount: 0,
        sendErrors: null,
        sendCompletedAt: null,
      },
    });

    // If we couldn't lock (already being processed or not queued), check for resume
    if (updated.count === 0) {
      const current = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { sendStatus: true },
      });

      if (current?.sendStatus === 'sending') {
        // Resume scenario - allow continuing
        console.log(`[NotifSender] Resuming notification ${notificationId}`);
      } else {
        console.log(`[NotifSender] Notification ${notificationId} is '${current?.sendStatus}', skipping`);
        return;
      }
    }

    // Load the notification
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      console.error(`[NotifSender] Notification ${notificationId} not found`);
      return;
    }

    // Initialize FCM
    const fcmReady = await initializeFCM();
    if (!fcmReady) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          sendStatus: 'failed',
          sendErrors: JSON.stringify(['FCM not initialized. Check service account credentials.']),
          sendCompletedAt: new Date(),
        },
      });
      return;
    }

    // Fetch all FCM tokens (same logic as sendPushNotificationToAll)
    const devices = await prisma.userDevice.findMany({
      where: { appUser: { status: 'Active' } },
      select: { fcmToken: true, appUserId: true },
    });

    const usersWithLegacyToken = await prisma.appUser.findMany({
      where: { fcmToken: { not: null }, status: 'Active' },
      select: { id: true, fcmToken: true },
    });

    const allTokens: string[] = [];
    const userIds = new Set<string>();

    for (const device of devices) {
      allTokens.push(device.fcmToken);
      userIds.add(device.appUserId);
    }

    for (const user of usersWithLegacyToken) {
      if (user.fcmToken && !allTokens.includes(user.fcmToken)) {
        allTokens.push(user.fcmToken);
        userIds.add(user.id);
      }
    }

    const fcmTokens = [...new Set(allTokens)];

    // Update total count
    await prisma.notification.update({
      where: { id: notificationId },
      data: { sendTotal: fcmTokens.length },
    });

    if (fcmTokens.length === 0) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          sendStatus: 'sent',
          sendTotal: 0,
          sendCompletedAt: new Date(),
        },
      });
      return;
    }

    // Create a single PushNotificationLog entry for this batch send
    const logId = await logPushNotification({
      recipientCount: fcmTokens.length,
      title: notification.title,
      body: notification.description,
      imageUrl: notification.image || undefined,
      dataPayload: { notificationId: notification.id, type: 'notification' },
      source: 'admin' as NotificationSource,
      type: 'general' as NotificationType,
      sourceId: notification.id,
    });

    // Prepare FCM payload
    const imageUrl = notification.image
      ? (notification.image.startsWith('http://') || notification.image.startsWith('https://'))
        ? notification.image
        : `${process.env.NEXTAUTH_URL || 'https://appanel.alternatehealthclub.com'}${notification.image}`
      : undefined;

    // Validate image URL
    let validImageUrl: string | undefined = undefined;
    if (imageUrl && imageUrl.trim()) {
      try {
        const url = new URL(imageUrl.trim());
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          validImageUrl = imageUrl.trim();
        }
      } catch {
        // Invalid URL, skip image
      }
    }

    const fcmData: Record<string, string> = {
      notificationId: notification.id,
      type: 'notification',
    };
    if (notification.url) {
      fcmData.url = notification.url;
    }

    const collapseKey = `notif_${notification.id}`;

    // Determine start index for resume
    const startIndex = updated.count === 0 ? notification.sendProgress : 0;
    let currentSuccess = updated.count === 0 ? notification.successCount : 0;
    let currentFailure = updated.count === 0 ? notification.failureCount : 0;
    const errors: string[] = [];
    const invalidTokens: string[] = [];

    console.log(`[NotifSender] Sending to ${fcmTokens.length} tokens (starting from ${startIndex}) for notification ${notificationId}`);

    // Get the Firebase app reference
    const firebaseApp = admin.apps.length > 0 ? admin.app() : null;
    if (!firebaseApp) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          sendStatus: 'failed',
          sendErrors: JSON.stringify(['Firebase app not available']),
          sendCompletedAt: new Date(),
        },
      });
      return;
    }

    // Send in small batches
    for (let i = startIndex; i < fcmTokens.length; i += BATCH_SIZE) {
      const batch = fcmTokens.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (token) => {
          const message: admin.messaging.Message = {
            token,
            notification: {
              title: notification.title,
              body: notification.description,
              ...(validImageUrl && { imageUrl: validImageUrl }),
            },
            data: {
              ...Object.fromEntries(Object.entries(fcmData).map(([k, v]) => [k, String(v)])),
              _dedupKey: collapseKey,
              _timestamp: String(Date.now()),
            },
            android: {
              priority: 'high',
              collapseKey,
              notification: {
                channelId: 'default',
                sound: 'default',
                priority: 'high',
                tag: collapseKey,
                ...(validImageUrl && { imageUrl: validImageUrl }),
              },
            },
            apns: {
              headers: {
                'apns-collapse-id': collapseKey,
                'apns-priority': '10',
                'apns-push-type': 'alert',
              },
              payload: {
                aps: {
                  sound: 'default',
                  'thread-id': collapseKey,
                  'content-available': 1,
                  ...(validImageUrl && { mutableContent: true }),
                },
              },
              ...(validImageUrl && {
                fcmOptions: {
                  imageUrl: validImageUrl,
                },
              }),
            },
          };

          try {
            await admin.messaging(firebaseApp).send(message);
            return { success: true, token };
          } catch (error: any) {
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
              invalidTokens.push(token);
            }
            throw error;
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          currentSuccess++;
        } else {
          currentFailure++;
          const err = result.reason;
          const errorCode = err?.code || 'unknown';
          const errorMsg = err?.message || 'Unknown error';
          const detailedError = errorCode !== 'unknown'
            ? `${errorCode}: ${errorMsg}`
            : errorMsg;
          if (errors.length < 10) errors.push(detailedError);
        }
      }

      // Update progress in DB
      const processed = Math.min(i + batch.length, fcmTokens.length);
      if (processed % PROGRESS_UPDATE_INTERVAL === 0 || processed === fcmTokens.length || processed === i + batch.length) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: {
            sendProgress: processed,
            successCount: currentSuccess,
            failureCount: currentFailure,
            receiverCount: currentSuccess,
            sendErrors: errors.length > 0 ? JSON.stringify(errors.slice(-10)) : null,
          },
        });
      }
    }

    // Remove invalid tokens from database
    if (invalidTokens.length > 0) {
      await prisma.appUser.updateMany({
        where: { fcmToken: { in: invalidTokens } },
        data: { fcmToken: null },
      });
      console.log(`[NotifSender] Removed ${invalidTokens.length} invalid FCM token(s)`);
    }

    // Set final status
    const finalStatus = currentFailure === 0 ? 'sent'
      : currentSuccess === 0 ? 'failed'
      : 'partial';

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        sendStatus: finalStatus,
        sendProgress: fcmTokens.length,
        successCount: currentSuccess,
        failureCount: currentFailure,
        receiverCount: currentSuccess,
        sendCompletedAt: new Date(),
        sendErrors: errors.length > 0 ? JSON.stringify(errors.slice(-10)) : null,
      },
    });

    // Update the PushNotificationLog entry
    if (logId) {
      await updatePushNotificationLog(logId, {
        status: finalStatus as any,
        successCount: currentSuccess,
        failureCount: currentFailure,
        errorMessage: errors.length > 0 ? errors.slice(0, 5).join('; ') : undefined,
      });
    }

    console.log(`[NotifSender] Completed ${notificationId}: ${currentSuccess} sent, ${currentFailure} failed out of ${fcmTokens.length}`);

  } catch (error: any) {
    console.error(`[NotifSender] Fatal error processing ${notificationId}:`, error);
    try {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          sendStatus: 'failed',
          sendCompletedAt: new Date(),
          sendErrors: JSON.stringify([error.message || 'Fatal processing error']),
        },
      });
    } catch (dbError) {
      console.error(`[NotifSender] Failed to update error status:`, dbError);
    }
  }
}
