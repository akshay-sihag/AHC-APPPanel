# Flutter App Integration Guide

## Overview

This document provides the architecture and implementation guide for integrating your Flutter app with the AHC backend push notification system and WooCommerce webhooks.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Firebase Setup](#firebase-setup)
3. [FCM Integration](#fcm-integration)
4. [API Endpoints](#api-endpoints)
5. [Data Models](#data-models)
6. [Push Notification Handling](#push-notification-handling)
7. [Notification Icons](#notification-icons)
8. [Navigation Deep Links](#navigation-deep-links)
9. [Best Practices](#best-practices)

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  WooCommerce    │────>│   AHC Backend    │────>│   Firebase      │
│  (Orders/Subs)  │     │   (Next.js)      │     │   FCM           │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │
                        │   Flutter App    │<─────────────┘
                        │                  │
                        │  ┌────────────┐  │
                        │  │ FCM Token  │──┼──> POST /api/app-users/fcm-token
                        │  └────────────┘  │
                        │  ┌────────────┐  │
                        │  │ Notif List │──┼──> GET /api/notifications/public
                        │  └────────────┘  │
                        │  ┌────────────┐  │
                        │  │ View Track │──┼──> POST /api/notifications/{id}/view
                        │  └────────────┘  │
                        └──────────────────┘
```

---

## Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project or use existing
3. Add Android app with your package name
4. Add iOS app with your bundle ID
5. Download config files:
   - Android: `google-services.json` → `android/app/`
   - iOS: `GoogleService-Info.plist` → `ios/Runner/`

### 2. Enable Cloud Messaging
1. Go to Project Settings → Cloud Messaging
2. Note your Server Key (legacy) - not needed for FCM v1
3. Generate Service Account JSON for backend

---

## FCM Integration

### Dependencies (pubspec.yaml)

```yaml
dependencies:
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.10
  flutter_local_notifications: ^16.3.0
  http: ^1.1.0

dev_dependencies:
  flutter_lints: ^3.0.0
```

### Initialize Firebase (main.dart)

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

// Background message handler (must be top-level)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('Background message: ${message.messageId}');
  // Handle background notification
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Set background handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  runApp(MyApp());
}
```

### FCM Service Class

```dart
// lib/services/fcm_service.dart

import 'dart:convert';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;

class FCMService {
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  String? _fcmToken;
  String get fcmToken => _fcmToken ?? '';

  // API Configuration
  static const String baseUrl = 'https://your-backend-domain.com';
  static const String apiKey = 'your-api-key';  // From dashboard

  Future<void> initialize() async {
    // Request permission
    NotificationSettings settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('Push notifications authorized');

      // Get FCM token
      _fcmToken = await _messaging.getToken();
      print('FCM Token: $_fcmToken');

      // Listen for token refresh
      _messaging.onTokenRefresh.listen(_onTokenRefresh);

      // Initialize local notifications (for foreground)
      await _initLocalNotifications();

      // Handle foreground messages
      FirebaseMessaging.onMessage.listen(_onForegroundMessage);

      // Handle notification tap (app in background)
      FirebaseMessaging.onMessageOpenedApp.listen(_onNotificationTap);

      // Check if app opened from notification
      RemoteMessage? initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        _onNotificationTap(initialMessage);
      }
    }
  }

  Future<void> _initLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    await _localNotifications.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
      onDidReceiveNotificationResponse: (response) {
        // Handle notification tap
        if (response.payload != null) {
          final data = jsonDecode(response.payload!);
          _navigateToScreen(data);
        }
      },
    );

    // Create notification channel for Android
    const channel = AndroidNotificationChannel(
      'default',
      'Default Notifications',
      description: 'Default notification channel',
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  void _onForegroundMessage(RemoteMessage message) {
    print('Foreground message: ${message.notification?.title}');

    // Show local notification
    _showLocalNotification(message);
  }

  void _onNotificationTap(RemoteMessage message) {
    print('Notification tapped: ${message.data}');
    _navigateToScreen(message.data);
  }

  void _onTokenRefresh(String token) {
    print('FCM token refreshed: $token');
    _fcmToken = token;
    // Re-register with backend
    registerToken();
  }

  Future<void> _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    // Get icon based on notification type
    final type = message.data['type'] ?? 'general';
    final iconName = _getNotificationIcon(type, message.data);

    await _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          'default',
          'Default Notifications',
          channelDescription: 'Default notification channel',
          importance: Importance.high,
          priority: Priority.high,
          icon: iconName,
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: jsonEncode(message.data),
    );
  }

  String _getNotificationIcon(String type, Map<String, dynamic> data) {
    // Map notification types to Android drawable icons
    final status = data['orderStatus'] ?? data['subscriptionStatus'] ?? '';

    switch (type) {
      case 'order_status':
        return _orderStatusIcon(status);
      case 'subscription_status':
        return _subscriptionStatusIcon(status);
      case 'promotion':
        return 'ic_promo';
      default:
        return 'ic_notification';
    }
  }

  String _orderStatusIcon(String status) {
    switch (status) {
      case 'pending':
        return 'ic_order_pending';
      case 'processing':
        return 'ic_order_processing';
      case 'completed':
        return 'ic_order_completed';
      case 'cancelled':
        return 'ic_order_cancelled';
      case 'refunded':
        return 'ic_order_refunded';
      case 'failed':
        return 'ic_order_failed';
      case 'on-hold':
        return 'ic_order_hold';
      default:
        return 'ic_order_pending';
    }
  }

  String _subscriptionStatusIcon(String status) {
    switch (status) {
      case 'active':
        return 'ic_sub_active';
      case 'on-hold':
        return 'ic_sub_hold';
      case 'cancelled':
        return 'ic_sub_cancelled';
      case 'expired':
        return 'ic_sub_expired';
      case 'pending':
        return 'ic_sub_pending';
      default:
        return 'ic_sub_pending';
    }
  }

  void _navigateToScreen(Map<String, dynamic> data) {
    final url = data['url'] as String?;
    final type = data['type'] as String?;

    if (url != null) {
      // Use your navigation service/router
      // Example: NavigationService.navigateTo(url);
      print('Navigate to: $url');
    }
  }

  // Register FCM token with backend
  Future<bool> registerToken({String? email, String? wpUserId}) async {
    if (_fcmToken == null) return false;

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/app-users/fcm-token'),
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: jsonEncode({
          'fcmToken': _fcmToken,
          'email': email,
          'wpUserId': wpUserId,
        }),
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Error registering FCM token: $e');
      return false;
    }
  }

  // Unregister FCM token (logout)
  Future<bool> unregisterToken({String? email, String? wpUserId}) async {
    try {
      final uri = Uri.parse('$baseUrl/api/app-users/fcm-token').replace(
        queryParameters: {
          if (email != null) 'email': email,
          if (wpUserId != null) 'wpUserId': wpUserId,
        },
      );

      final response = await http.delete(
        uri,
        headers: {'X-API-Key': apiKey},
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Error unregistering FCM token: $e');
      return false;
    }
  }
}
```

---

## API Endpoints

### Authentication
All API requests require an API key in the header:
```
X-API-Key: your-api-key
```
Or as Bearer token:
```
Authorization: Bearer your-api-key
```

### Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/app-users/fcm-token` | POST | Register/update FCM token |
| `/api/app-users/fcm-token?email=x` | DELETE | Remove FCM token |
| `/api/notifications/public` | GET | Get active notifications |
| `/api/notifications/{id}/view` | POST | Track notification view |
| `/api/app-users/register` | POST | Register new app user |
| `/api/app-users/get?email=x` | GET | Get user details |
| `/api/woocommerce/orders?email=x` | GET | Get user orders |
| `/api/woocommerce/subscriptions?email=x` | GET | Get user subscriptions |

### Register FCM Token

```http
POST /api/app-users/fcm-token
Content-Type: application/json
X-API-Key: your-api-key

{
  "fcmToken": "firebase-token-here",
  "email": "user@example.com",
  "wpUserId": "123"  // WordPress user ID
}
```

**Response:**
```json
{
  "success": true,
  "message": "FCM token registered successfully"
}
```

### Get Notifications

```http
GET /api/notifications/public?limit=20&page=1
X-API-Key: your-api-key
```

**Response:**
```json
{
  "notifications": [
    {
      "id": "clx123...",
      "title": "Order Completed",
      "description": "Your order #1234 has been completed!",
      "image": "https://...",
      "url": "/orders/1234",
      "type": "order_status",
      "icon": "ic_order_completed",
      "createdAt": "2026-01-13T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Track Notification View

```http
POST /api/notifications/{id}/view
Content-Type: application/json
X-API-Key: your-api-key

{
  "wpUserId": "123",
  "email": "user@example.com"
}
```

---

## Data Models

### Notification Model (Dart)

```dart
// lib/models/notification_model.dart

class NotificationModel {
  final String id;
  final String title;
  final String description;
  final String? image;
  final String? url;
  final String type;
  final String? icon;
  final bool isActive;
  final DateTime createdAt;

  NotificationModel({
    required this.id,
    required this.title,
    required this.description,
    this.image,
    this.url,
    this.type = 'general',
    this.icon,
    this.isActive = true,
    required this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'],
      title: json['title'],
      description: json['description'],
      image: json['image'],
      url: json['url'],
      type: json['type'] ?? 'general',
      icon: json['icon'],
      isActive: json['isActive'] ?? true,
      createdAt: DateTime.parse(json['createdAt']),
    );
  }

  // Get icon asset path
  String get iconAsset {
    if (icon != null) {
      return 'assets/icons/notifications/$icon.png';
    }
    return 'assets/icons/notifications/ic_notification.png';
  }

  // Get icon for display
  IconData get iconData {
    switch (type) {
      case 'order_status':
        return Icons.shopping_bag;
      case 'subscription_status':
        return Icons.autorenew;
      case 'promotion':
        return Icons.local_offer;
      default:
        return Icons.notifications;
    }
  }

  // Get color based on type
  Color get typeColor {
    switch (type) {
      case 'order_status':
        return Colors.blue;
      case 'subscription_status':
        return Colors.purple;
      case 'promotion':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }
}
```

### Push Notification Payload Structure

When a push notification is received, the data payload contains:

```json
{
  "notificationId": "clx123...",
  "type": "order_status",
  "orderId": "1234",
  "orderStatus": "completed",
  "url": "/orders/1234"
}
```

For subscriptions:
```json
{
  "notificationId": "clx456...",
  "type": "subscription_status",
  "subscriptionId": "5678",
  "subscriptionStatus": "active",
  "url": "/subscriptions/5678"
}
```

---

## Push Notification Handling

### Notification States

| State | Handler | User Action |
|-------|---------|-------------|
| Foreground | `onMessage` | Show local notification |
| Background | Background handler | Notification tray |
| Terminated | `getInitialMessage` | App launched from notification |
| Tapped | `onMessageOpenedApp` | Navigate to screen |

### Complete Implementation Example

```dart
// lib/screens/notifications_screen.dart

import 'package:flutter/material.dart';
import '../models/notification_model.dart';
import '../services/api_service.dart';

class NotificationsScreen extends StatefulWidget {
  @override
  _NotificationsScreenState createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationModel> _notifications = [];
  bool _isLoading = true;
  int _page = 1;
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    try {
      final result = await ApiService().getNotifications(page: _page);
      setState(() {
        _notifications = result.notifications;
        _hasMore = _page < result.totalPages;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      // Show error
    }
  }

  Future<void> _onNotificationTap(NotificationModel notification) async {
    // Track view
    await ApiService().trackNotificationView(notification.id);

    // Navigate based on URL
    if (notification.url != null) {
      _navigateToUrl(notification.url!);
    }
  }

  void _navigateToUrl(String url) {
    // Parse URL and navigate
    if (url.startsWith('/orders/')) {
      final orderId = url.split('/').last;
      Navigator.pushNamed(context, '/order-details', arguments: orderId);
    } else if (url.startsWith('/subscriptions/')) {
      final subId = url.split('/').last;
      Navigator.pushNamed(context, '/subscription-details', arguments: subId);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Notifications')),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadNotifications,
              child: ListView.builder(
                itemCount: _notifications.length,
                itemBuilder: (context, index) {
                  final notification = _notifications[index];
                  return _NotificationTile(
                    notification: notification,
                    onTap: () => _onNotificationTap(notification),
                  );
                },
              ),
            ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final NotificationModel notification;
  final VoidCallback onTap;

  const _NotificationTile({
    required this.notification,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: notification.typeColor.withOpacity(0.1),
        child: Icon(notification.iconData, color: notification.typeColor),
      ),
      title: Text(notification.title),
      subtitle: Text(
        notification.description,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Text(
        _timeAgo(notification.createdAt),
        style: TextStyle(color: Colors.grey, fontSize: 12),
      ),
      onTap: onTap,
    );
  }

  String _timeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
    return 'Just now';
  }
}
```

---

## Notification Icons

### Android Icons Setup

Place icons in: `android/app/src/main/res/drawable/`

Required icons (24x24dp, white on transparent):
```
drawable/
├── ic_notification.png
├── ic_promo.png
├── ic_order_pending.png
├── ic_order_processing.png
├── ic_order_completed.png
├── ic_order_cancelled.png
├── ic_order_refunded.png
├── ic_order_failed.png
├── ic_order_hold.png
├── ic_sub_active.png
├── ic_sub_hold.png
├── ic_sub_cancelled.png
├── ic_sub_expired.png
└── ic_sub_pending.png
```

### Flutter Asset Icons

For in-app display, place icons in: `assets/icons/notifications/`

```yaml
# pubspec.yaml
flutter:
  assets:
    - assets/icons/notifications/
```

---

## Navigation Deep Links

### URL Scheme

Configure deep links to handle notification URLs:

| URL Pattern | Screen | Parameters |
|-------------|--------|------------|
| `/orders/{id}` | Order Details | orderId |
| `/subscriptions/{id}` | Subscription Details | subscriptionId |
| `/notifications` | Notification List | - |
| `/profile` | User Profile | - |

### Android Deep Link Setup (AndroidManifest.xml)

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data
    android:scheme="ahc"
    android:host="app" />
</intent-filter>
```

### iOS Deep Link Setup (Info.plist)

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>ahc</string>
    </array>
  </dict>
</array>
```

---

## Best Practices

### 1. Token Management
- Register token immediately after login
- Update token on refresh
- Remove token on logout

```dart
// On Login
await FCMService().registerToken(email: user.email, wpUserId: user.wpId);

// On Logout
await FCMService().unregisterToken(email: user.email);
```

### 2. Error Handling
- Handle network errors gracefully
- Cache notifications locally
- Show offline indicator

### 3. Performance
- Paginate notification list
- Lazy load images
- Cache API responses

### 4. User Experience
- Show badge count on notification icon
- Mark notifications as read on view
- Allow swipe to dismiss

### 5. Testing
- Test on both Android and iOS
- Test background/terminated states
- Test with different notification types

---

## Troubleshooting

### FCM Token Not Generated
- Check Firebase configuration files
- Verify internet connection
- Check Firebase Console for errors

### Notifications Not Received
- Verify FCM token is registered with backend
- Check Firebase Cloud Messaging is enabled
- Test with Firebase Console "Test Message"

### Icons Not Showing
- Verify icon files exist in drawable folder
- Icons must be white on transparent
- Icon names must match exactly

### Navigation Not Working
- Check URL parsing logic
- Verify deep link configuration
- Test with `adb shell am start -a android.intent.action.VIEW -d "ahc://app/orders/123"`

---

## Support

For issues with:
- **Backend API**: Check server logs and API documentation
- **Firebase**: Check Firebase Console and documentation
- **Flutter**: Check Flutter documentation and pub.dev packages

---

*Last updated: January 2026*
