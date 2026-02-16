import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function AuthCallback() {
  const router = useRouter();
  const { login } = useAuth();
  const { colors } = useTheme();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        let sessionId: string | null = null;

        // Try to get session_id from URL hash (web) or params
        if (typeof window !== 'undefined' && window.location.hash) {
          const hash = window.location.hash;
          const match = hash.match(/session_id=([^&]+)/);
          if (match) sessionId = match[1];
        }

        if (!sessionId) {
          // Try search params
          const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
          sessionId = params.get('session_id');
        }

        if (sessionId) {
          const user = await login(sessionId);
          if (user) {
            router.replace('/(tabs)/home');
            return;
          }
        }
        
        router.replace('/');
      } catch {
        router.replace('/');
      }
    };

    processAuth();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
  },
});
