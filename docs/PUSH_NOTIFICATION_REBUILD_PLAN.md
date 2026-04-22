# Push Notification System Rebuild Plan

## Current State Analysis

### What Exists
1. **FCM Service** (`lib/fcm-service.ts`) - Firebase Admin SDK v13.6.0 with FCM API v1
2. **Notification CRUD** - Full admin dashboard with create/read/update/delete
3. **Webhooks** - Order and subscription status handlers
4. **FCM Token Management** - Register/update/delete tokens per user

### Issues Found

| Issue | Severity | Location |
|-------|----------|----------|
| Duplicate `sendPushNotificationToUser` function | Medium | `fcm-service.ts` + webhook files |
| No notification type/icon field in database | Medium | `schema.prisma` |
| Webhooks create notifications visible in dashboard | High | Webhook routes |
| No HMAC signature verification for webhooks | Medium | Webhook routes |
| No retry mechanism for failed pushes | Low | `fcm-service.ts` |
| No notification categories/types | Medium | Schema |

---

## Rebuild Plan

### Phase 1: Database Schema Updates

Add new fields to support notification types and webhook-specific notifications:

```prisma
model Notification {
  id            String   @id @default(cuid())
  title         String
  description   String   @db.Text
  image         String?
  url           String?

  // NEW FIELDS
  type          String   @default("general")  // general, order, subscription, promotion
  icon          String?                        // Icon identifier for mobile app
  source        String   @default("admin")     // admin, webhook, system
  targetUserId  String?                        // For user-specific notifications (webhook)
  metadata      Json?                          // Store order_id, subscription_id, etc.

  isActive      Boolean  @default(true)
  receiverCount Int      @default(0)
  viewCount     Int      @default(0)
  views         NotificationView[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([type])
  @@index([source])
  @@index([targetUserId])
}
```

### Phase 2: FCM Service Cleanup

**Remove duplicate code:**
- Delete `sendPushNotificationToUser` from webhook files
- Import from `lib/fcm-service.ts` instead

**Add notification type support:**
```typescript
interface PushNotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  type: 'general' | 'order' | 'subscription' | 'promotion';
  icon?: string;
  data?: Record<string, string>;
}
```

**Icon mapping for statuses:**
```typescript
const STATUS_ICONS = {
  // Order statuses
  'order_pending': 'ic_order_pending',
  'order_processing': 'ic_order_processing',
  'order_completed': 'ic_order_completed',
  'order_cancelled': 'ic_order_cancelled',
  'order_refunded': 'ic_order_refunded',
  'order_failed': 'ic_order_failed',
  'order_on-hold': 'ic_order_hold',

  // Subscription statuses
  'subscription_active': 'ic_sub_active',
  'subscription_on-hold': 'ic_sub_hold',
  'subscription_cancelled': 'ic_sub_cancelled',
  'subscription_expired': 'ic_sub_expired',
  'subscription_pending': 'ic_sub_pending',

  // General
  'general': 'ic_notification',
  'promotion': 'ic_promo',
};
```

### Phase 3: Webhook Improvements

**Key Changes:**
1. Webhooks will NOT create notifications in the main Notification table
2. Create a separate `WebhookNotification` model for user-specific notifications
3. Send push directly without polluting admin notification list
4. Add proper HMAC signature verification

**New Webhook Flow:**
```
WooCommerce -> Webhook API -> Validate Signature -> Send Push -> Log Result
                                    |
                                    v
                           (No admin notification created)
```

**New Webhook Notification Model:**
```prisma
model WebhookLog {
  id            String   @id @default(cuid())
  source        String                         // woocommerce
  event         String                         // order_status, subscription_status
  resourceId    String                         // Order/Subscription ID
  status        String                         // Status received
  customerEmail String?

  pushSent      Boolean  @default(false)
  pushSuccess   Boolean  @default(false)
  pushError     String?

  payload       Json?                          // Raw webhook payload (for debugging)

  createdAt     DateTime @default(now())

  @@index([source, event])
  @@index([customerEmail])
  @@index([resourceId])
}
```

### Phase 4: API Structure

**Existing (Keep):**
- `POST /api/notifications` - Create & send notification (admin)
- `GET /api/notifications` - List notifications (admin)
- `GET /api/notifications/public` - Get notifications for app
- `POST /api/app-users/fcm-token` - Register FCM token

**Webhooks (Modify):**
- `POST /api/webhooks/woocommerce/order-status` - Order updates
- `POST /api/webhooks/woocommerce/subscription-status` - Subscription updates

**New (Add):**
- `GET /api/webhooks/logs` - View webhook logs (admin, optional)
- `POST /api/webhooks/test` - Test webhook endpoint (admin)

---

## Implementation Tasks

### Task 1: Schema Migration
- [ ] Add `type`, `icon`, `source`, `targetUserId`, `metadata` to Notification
- [ ] Create `WebhookLog` model
- [ ] Run migration

### Task 2: FCM Service Refactor
- [ ] Create centralized type definitions
- [ ] Add icon mapping utility
- [ ] Remove duplicate functions from webhooks
- [ ] Add notification type to push payload

### Task 3: Webhook Refactor
- [ ] Remove notification creation from webhooks
- [ ] Add WebhookLog creation instead
- [ ] Implement HMAC signature verification
- [ ] Add status-based icon selection
- [ ] Import `sendPushNotificationToUser` from fcm-service

### Task 4: Testing
- [ ] Test FCM with different notification types
- [ ] Test webhook endpoints
- [ ] Verify icons in Flutter app

---

## Webhook Configuration (WooCommerce)

### Order Status Webhook
```
Name: Order Status Updates
Delivery URL: https://your-domain.com/api/webhooks/woocommerce/order-status
Secret: [Generate secure secret]
Topic: Order updated
Status: Active
```

### Subscription Status Webhook
```
Name: Subscription Status Updates
Delivery URL: https://your-domain.com/api/webhooks/woocommerce/subscription-status
Secret: [Same secret or different]
Topic: Subscription updated
Status: Active
```

### Environment Variables
```env
WOOCOMMERCE_WEBHOOK_SECRET=your-secure-webhook-secret
```

---

## Icon Assets Required (Flutter)

Create these icons in your Flutter assets:

```
assets/icons/notifications/
├── ic_notification.png      # Default notification
├── ic_promo.png            # Promotions
├── ic_order_pending.png    # Order pending
├── ic_order_processing.png # Order processing
├── ic_order_completed.png  # Order completed (checkmark)
├── ic_order_cancelled.png  # Order cancelled (X)
├── ic_order_refunded.png   # Order refunded
├── ic_order_failed.png     # Order failed (warning)
├── ic_order_hold.png       # Order on hold
├── ic_sub_active.png       # Subscription active
├── ic_sub_hold.png         # Subscription on hold
├── ic_sub_cancelled.png    # Subscription cancelled
├── ic_sub_expired.png      # Subscription expired
└── ic_sub_pending.png      # Subscription pending
```

---

## Summary

This rebuild will:
1. Clean up duplicate code
2. Separate webhook notifications from admin notifications
3. Add proper notification typing and icons
4. Improve webhook security with signature verification
5. Provide clear icon mapping for Flutter app
