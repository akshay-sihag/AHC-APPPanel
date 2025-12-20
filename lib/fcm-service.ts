import { prisma } from './prisma';

let fcmInitialized = false;
let fcmServerKey: string | null = null;

/**
 * Initialize FCM (using server key approach)
 * Note: For production, it's recommended to use Firebase Admin SDK with service account JSON
 */
export async function initializeFCM(): Promise<boolean> {
  if (fcmInitialized && fcmServerKey) {
    return true;
  }

  try {
    // Get FCM settings from database
    const settings = await prisma.settings.findUnique({
      where: { id: 'settings' },
    });

    if (!settings?.fcmServerKey) {
      console.warn('FCM server key not configured');
      return false;
    }

    fcmServerKey = settings.fcmServerKey;
    fcmInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize FCM:', error);
    return false;
  }
}

/**
 * Send push notification to a single device using FCM HTTP API
 */
export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const initialized = await initializeFCM();
    if (!initialized || !fcmServerKey) {
      return {
        success: false,
        error: 'FCM not initialized. Please configure FCM settings.',
      };
    }

    // Build notification payload
    const payload: any = {
      to: fcmToken,
      notification: {
        title,
        body,
        ...(imageUrl && { image: imageUrl }),
      },
      data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high',
        },
      },
    };

    // Send via FCM HTTP API
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${fcmServerKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || result.failure === 1) {
      // Handle invalid token
      if (result.results?.[0]?.error === 'InvalidRegistration' || 
          result.results?.[0]?.error === 'NotRegistered') {
        // Remove invalid token from database
        await prisma.appUser.updateMany({
          where: { fcmToken },
          data: { fcmToken: null },
        });
        return {
          success: false,
          error: 'Invalid FCM token',
        };
      }

      return {
        success: false,
        error: result.results?.[0]?.error || 'Failed to send push notification',
      };
    }

    return {
      success: true,
      messageId: result.message_id || result.multicast_id?.toString(),
    };
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return {
      success: false,
      error: error.message || 'Failed to send push notification',
    };
  }
}

/**
 * Send push notification to multiple devices using FCM HTTP API
 * FCM supports up to 1000 tokens per request
 */
export async function sendPushNotificationToMultiple(
  fcmTokens: string[],
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>
): Promise<{ successCount: number; failureCount: number; errors: string[] }> {
  try {
    const initialized = await initializeFCM();
    if (!initialized || !fcmServerKey) {
      return {
        successCount: 0,
        failureCount: fcmTokens.length,
        errors: ['FCM not initialized. Please configure FCM settings.'],
      };
    }

    if (fcmTokens.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        errors: [],
      };
    }

    // FCM supports up to 1000 tokens per request
    const batchSize = 1000;
    let totalSuccess = 0;
    let totalFailure = 0;
    const allErrors: string[] = [];
    const invalidTokens: string[] = [];

    // Process in batches
    for (let i = 0; i < fcmTokens.length; i += batchSize) {
      const batch = fcmTokens.slice(i, i + batchSize);

      const payload: any = {
        registration_ids: batch,
        notification: {
          title,
          body,
          ...(imageUrl && { image: imageUrl }),
        },
        data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'high',
          },
        },
      };

      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${fcmServerKey}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.results) {
        result.results.forEach((res: any, idx: number) => {
          if (res.error) {
            totalFailure++;
            allErrors.push(res.error);
            // Track invalid tokens
            if (res.error === 'InvalidRegistration' || res.error === 'NotRegistered') {
              invalidTokens.push(batch[idx]);
            }
          } else {
            totalSuccess++;
          }
        });
      } else {
        totalFailure += batch.length;
        allErrors.push('Unknown error from FCM');
      }
    }

    // Remove invalid tokens from database
    if (invalidTokens.length > 0) {
      await prisma.appUser.updateMany({
        where: {
          fcmToken: {
            in: invalidTokens,
          },
        },
        data: {
          fcmToken: null,
        },
      });
    }

    return {
      successCount: totalSuccess,
      failureCount: totalFailure,
      errors: allErrors,
    };
  } catch (error: any) {
    console.error('Error sending multicast push notification:', error);
    return {
      successCount: 0,
      failureCount: fcmTokens.length,
      errors: [error.message || 'Failed to send push notifications'],
    };
  }
}

/**
 * Send push notification to all active users
 */
export async function sendPushNotificationToAll(
  title: string,
  body: string,
  imageUrl?: string,
  data?: Record<string, string>
): Promise<{ successCount: number; failureCount: number; totalUsers: number }> {
  try {
    // Get all active users with FCM tokens
    const users = await prisma.appUser.findMany({
      where: {
        fcmToken: {
          not: null,
        },
        status: 'Active',
      },
      select: {
        fcmToken: true,
      },
    });

    const fcmTokens = users
      .map((u) => u.fcmToken)
      .filter((token): token is string => token !== null);

    if (fcmTokens.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        totalUsers: 0,
      };
    }

    const result = await sendPushNotificationToMultiple(fcmTokens, title, body, imageUrl, data);

    return {
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalUsers: fcmTokens.length,
    };
  } catch (error: any) {
    console.error('Error sending push notification to all users:', error);
    return {
      successCount: 0,
      failureCount: 0,
      totalUsers: 0,
    };
  }
}

