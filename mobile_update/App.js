import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import AppNavigator from './src/navigation/AppNavigator';
import {
  registerPushNotifications,
  attachNotificationListeners,
} from './src/services/pushNotifications';

// Keep system font scaling from making fixed-width cards overflow on small devices.
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.maxFontSizeMultiplier = 1.15;
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.maxFontSizeMultiplier = 1.15;

function PushRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    let cleanup;

    if (!user) {
      return undefined;
    }

    const register = async () => {
      try {
        console.log('[PUSH] Registering notifications for user:', user.id);

        await registerPushNotifications();

        console.log('[PUSH] Registration completed.');
      } catch (error) {
        console.warn('[PUSH] Registration failed:', error);
      }
    };

    register();

    cleanup = attachNotificationListeners();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [user?.id]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <StatusBar style="dark" />
        <PushRegistration />
        <AppNavigator />
      </CartProvider>
    </AuthProvider>
  );
}

