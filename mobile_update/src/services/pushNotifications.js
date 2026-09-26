import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isFcmAvailabilityError = (error) =>
  String(error?.message || error).includes('SERVICE_NOT_AVAILABLE');

async function getExpoPushToken(projectId) {
  const delays = [0, 1000, 2000];

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) {
      await wait(delays[attempt]);
    }

    try {
      return await Notifications.getExpoPushTokenAsync({ projectId });
    } catch (error) {
      if (!isFcmAvailabilityError(error) || attempt === delays.length - 1) {
        throw error;
      }

      console.warn(
        `[PUSH] FCM unavailable; retrying token fetch (${attempt + 2}/${delays.length}).`,
      );
    }
  }
}

export async function registerPushNotifications() {
  try {
    console.log('[PUSH] Starting registration...');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('freshcart-high', {
        name: 'FreshCart Alerts',
        description: 'FreshCart order, price and offer notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });

      console.log('[PUSH] Android high-priority channel ready.');
    }

    const current = await Notifications.getPermissionsAsync();

    console.log(
      '[PUSH] Current permission:',
      current.status
    );

    let status = current.status;

    if (status !== 'granted') {
      const requested =
        await Notifications.requestPermissionsAsync();

      status = requested.status;

      console.log(
        '[PUSH] Requested permission:',
        status
      );
    }

    if (status !== 'granted') {
      console.warn(
        '[PUSH] Notification permission was not granted.'
      );
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    console.log('[PUSH] EAS projectId:', projectId);

    if (!projectId) {
      console.warn(
        '[PUSH] EAS projectId missing. Run eas init and rebuild.'
      );
      return null;
    }

    const expoPushToken = await getExpoPushToken(projectId);

    const token = expoPushToken?.data;

    console.log(
      '[PUSH] Expo Push Token:',
      token
    );

    if (!token) {
      console.warn(
        '[PUSH] Expo Push Token was not returned.'
      );
      return null;
    }

    if (!token.startsWith('ExponentPushToken[')) {
      console.warn(
        '[PUSH] Invalid Expo Push Token:',
        token
      );
      return null;
    }

    console.log(
      '[PUSH] Sending token to FreshCart backend...'
    );

    const response = await api.post(
      '/notifications/push-token',
      {
        token,
        platform: Platform.OS,
      }
    );

    console.log(
      '[PUSH] Backend registration successful:',
      response?.status,
      response?.data
    );

    console.log(
      '[PUSH] Push notification registration completed.'
    );

    return token;
  } catch (error) {
    console.error(
      '[PUSH] Push registration failed:',
      error?.response?.status,
      error?.response?.data || error?.message || error
    );

    return null;
  }
}

export function attachNotificationListeners() {
  const received =
    Notifications.addNotificationReceivedListener(
      notification => {
        console.log(
          '[PUSH] Notification received:',
          notification?.request?.content
        );
      }
    );

  const response =
    Notifications.addNotificationResponseReceivedListener(
      notificationResponse => {
        console.log(
          '[PUSH] Notification tapped:',
          notificationResponse?.notification?.request?.content
        );
      }
    );

  return () => {
    received.remove();
    response.remove();
  };
}