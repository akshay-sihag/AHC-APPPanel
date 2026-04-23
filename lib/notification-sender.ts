import { prisma } from './prisma';
import { initializeFCM, logPushNotification, updatePushNotificationLog, sendPushNotificationToTopic } from './fcm-service';
import type { NotificationSource, NotificationType } from './fcm-service';
import * as admin from 'firebase-admin';

// sendEachForMulticast supports up to 500 tokens but has HTTP/2 stream limits;
// 100 is a safe sweet spot that avoids connection issues while being efficient.
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_BATCH_DELAY_MS = 2000;

// Topic that every Flutter client subscribes to on launch.
// Must match the string used in the Flutter app's FCMService.initialize().
const BROADCAST_TOPIC = 'all_users';

/**
 * Count active app users that currently have at least one FCM token registered.
 * Used as the "estimated recipients" number shown in the admin panel for topic
 * broadcasts (FCM does not return per-device delivery stats for topic sends).
 */
async function countActiveSubscribers(): Promise<number> {
  const [deviceUserIds, legacyUsers] = await Promise.all([
    prisma.userDevice.findMany({
      where: { appUser: { status: 'Active' } },
      select: { appUserId: true },
      distinct: ['appUserId'],
    }),
    prisma.appUser.findMany({
      where: { fcmToken: { not: null }, status: 'Active' },
      select: { id: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const d of deviceUserIds) ids.add(d.appUserId);
  for (const u of legacyUsers) ids.add(u.id);
  return ids.size;
}

/** Yield the event loop so other requests (dashboard, API) can be served */
function yieldEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

async function getAllFcmTokens(): Promise<string[]> {
  const devices = await prisma.userDevice.findMany({
    where: { appUser: { status: 'Active' } },
    select: { fcmToken: true, appUserId: true },
  });

  const usersWithLegacyToken = await prisma.appUser.findMany({
    where: { fcmToken: { not: null }, status: 'Active' },
    select: { id: true, fcmToken: true },
  });

  const allTokens: string[] = [];

  for (const device of devices) {
    allTokens.push(device.fcmToken);
  }

  for (const user of usersWithLegacyToken) {
    if (user.fcmToken && !allTokens.includes(user.fcmToken)) {
      allTokens.push(user.fcmToken);
    }
  }

  return [...new Set(allTokens)];
}

async function getFcmTokensForUser(appUserId: string): Promise<string[]> {
  const devices = await prisma.userDevice.findMany({
    where: { appUserId },
    select: { fcmToken: true },
  });

  const user = await prisma.appUser.findUnique({
    where: { id: appUserId },
    select: { fcmToken: true },
  });

  const allTokens: string[] = devices.map(d => d.fcmToken);
  if (user?.fcmToken && !allTokens.includes(user.fcmToken)) {
    allTokens.push(user.fcmToken);
  }

  return [...new Set(allTokens)];
}

/**
 * Process push notification sending in the background.
 * Designed to be called from after() or cron resume.
 *
 * Sends notifications in small batches to avoid overwhelming the server.
 * Updates progress in the database so the frontend can poll for real-time updates.
 * Supports resuming from where it left off after crashes.
 */
export async function processNotificationSend(notificationId: string, retryOnly: boolean = false): Promise<void> {
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
        // For retry, successCount is preserved by the send route; don't reset it here
        ...(retryOnly ? {} : { successCount: 0 }),
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

    // ─────────────────────────────────────────────────────────────────────
    // BROADCAST PATH: one API call to the 'all_users' FCM topic.
    // Google handles fan-out to every subscribed device. No batching, no
    // token iteration, no memory pressure.
    // ─────────────────────────────────────────────────────────────────────
    if (!notification.targetAppUserId && !retryOnly) {
      const estimatedRecipients = await countActiveSubscribers();

      const imageUrl = notification.image
        ? (notification.image.startsWith('http://') || notification.image.startsWith('https://'))
          ? notification.image
          : `${process.env.NEXTAUTH_URL || 'https://appanel.alternatehealthclub.com'}${notification.image}`
        : undefined;

      const fcmData: Record<string, string> = {
        notificationId: notification.id,
        type: 'notification',
      };
      if (notification.url) fcmData.url = notification.url;

      const logId = await logPushNotification({
        recipientCount: estimatedRecipients,
        title: notification.title,
        body: notification.description,
        imageUrl: notification.image || undefined,
        dataPayload: { notificationId: notification.id, type: 'notification' },
        source: 'admin' as NotificationSource,
        type: 'general' as NotificationType,
        sourceId: notification.id,
      });

      const result = await sendPushNotificationToTopic(
        BROADCAST_TOPIC,
        notification.title,
        notification.description,
        imageUrl,
        fcmData,
        { collapseKey: `notif_${notification.id}` }
      );

      if (result.success) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: {
            sendStatus: 'sent',
            sendTotal: estimatedRecipients,
            sendProgress: estimatedRecipients,
            successCount: estimatedRecipients,
            failureCount: 0,
            receiverCount: estimatedRecipients,
            sendCompletedAt: new Date(),
            sendErrors: null,
            failedTokens: null,
          },
        });

        if (logId) {
          await updatePushNotificationLog(logId, {
            status: 'sent',
            successCount: estimatedRecipients,
            failureCount: 0,
            fcmMessageId: result.messageId,
          });
        }

        console.log(`[NotifSender] Topic broadcast complete for ${notificationId} (~${estimatedRecipients} subscribers)`);
      } else {
        await prisma.notification.update({
          where: { id: notificationId },
          data: {
            sendStatus: 'failed',
            sendTotal: estimatedRecipients,
            sendProgress: 0,
            successCount: 0,
            failureCount: estimatedRecipients,
            sendCompletedAt: new Date(),
            sendErrors: JSON.stringify([result.error || 'Topic send failed']),
          },
        });

        if (logId) {
          await updatePushNotificationLog(logId, {
            status: 'failed',
            successCount: 0,
            failureCount: estimatedRecipients,
            errorMessage: result.error,
            errorCode: result.errorCode,
          });
        }
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // TARGETED / RETRY PATH: per-token send (single user or retry of
    // previously-failed tokens). Keeps the existing batch + progress logic.
    // ─────────────────────────────────────────────────────────────────────

    // Determine which tokens to send to
    let fcmTokens: string[];

    if (retryOnly && notification.failedTokens) {
      // Retry mode: only send to previously failed tokens
      try {
        fcmTokens = JSON.parse(notification.failedTokens) as string[];
        console.log(`[NotifSender] Retry mode: sending to ${fcmTokens.length} previously failed tokens`);
      } catch {
        console.error(`[NotifSender] Failed to parse failedTokens, falling back to all tokens`);
        fcmTokens = notification.targetAppUserId
          ? await getFcmTokensForUser(notification.targetAppUserId)
          : await getAllFcmTokens();
      }
    } else if (notification.targetAppUserId) {
      // Targeted send: only send to a specific user
      fcmTokens = await getFcmTokensForUser(notification.targetAppUserId);
      console.log(`[NotifSender] Targeted send to user ${notification.targetAppUserId}: ${fcmTokens.length} token(s)`);
    } else {
      fcmTokens = await getAllFcmTokens();
    }

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

    // Per-notification batch settings (with defaults)
    const batchSize = notification.batchSize || DEFAULT_BATCH_SIZE;
    const batchDelayMs = notification.batchDelayMs ?? DEFAULT_BATCH_DELAY_MS;

    // Determine start index for resume
    const isResume = updated.count === 0;
    const startIndex = isResume ? notification.sendProgress : 0;
    let currentSuccess = isResume ? notification.successCount : (retryOnly ? notification.successCount : 0);
    let currentFailure = isResume ? notification.failureCount : 0;
    const errors: string[] = [];
    const invalidTokens: string[] = [];
    const failedSendTokens: string[] = [];

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

    // Build the multicast message (same message for all tokens)
    const multicastBase: admin.messaging.MulticastMessage = {
      tokens: [], // will be set per batch
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

    // Send in batches using sendEachForMulticast (one API call per batch instead of per token)
    for (let i = startIndex; i < fcmTokens.length; i += batchSize) {
      const batchTokens = fcmTokens.slice(i, i + batchSize);

      try {
        // sendEachForMulticast sends one multicast API call for the entire batch
        const response = await admin.messaging(firebaseApp).sendEachForMulticast({
          ...multicastBase,
          tokens: batchTokens,
        });

        // Process individual results
        response.responses.forEach((resp, idx) => {
          if (resp.success) {
            currentSuccess++;
          } else {
            currentFailure++;
            const token = batchTokens[idx];
            failedSendTokens.push(token);
            const errorCode = resp.error?.code || 'unknown';
            if (errorCode === 'messaging/invalid-registration-token' ||
                errorCode === 'messaging/registration-token-not-registered') {
              invalidTokens.push(token);
            }
            const errorMsg = resp.error?.message || 'Unknown error';
            const detailedError = errorCode !== 'unknown'
              ? `${errorCode}: ${errorMsg}`
              : errorMsg;
            if (errors.length < 10) errors.push(detailedError);
          }
        });
      } catch (error: any) {
        // Entire batch failed (network error, etc.) — mark all tokens as failed
        currentFailure += batchTokens.length;
        failedSendTokens.push(...batchTokens);
        const errorMsg = error?.message || 'Batch send failed';
        if (errors.length < 10) errors.push(errorMsg);
      }

      // Update progress in DB after each batch
      const processed = Math.min(i + batchTokens.length, fcmTokens.length);
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

      // Yield event loop + delay between batches so other requests can be served
      if (i + batchSize < fcmTokens.length) {
        await yieldEventLoop();
        await new Promise(resolve => setTimeout(resolve, batchDelayMs));
      }
    }

    // Remove invalid tokens from database (both UserDevice and legacy AppUser.fcmToken)
    if (invalidTokens.length > 0) {
      await Promise.all([
        prisma.userDevice.deleteMany({
          where: { fcmToken: { in: invalidTokens } },
        }),
        prisma.appUser.updateMany({
          where: { fcmToken: { in: invalidTokens } },
          data: { fcmToken: null },
        }),
      ]);
      console.log(`[NotifSender] Removed ${invalidTokens.length} invalid FCM token(s)`);
    }

    // Set final status
    const finalStatus = currentFailure === 0 ? 'sent'
      : currentSuccess === 0 ? 'failed'
      : 'partial';

    // Store failed tokens (excluding invalid ones that were removed) for retry
    const retryableTokens = failedSendTokens.filter(t => !invalidTokens.includes(t));

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
        failedTokens: retryableTokens.length > 0 ? JSON.stringify(retryableTokens) : null,
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
