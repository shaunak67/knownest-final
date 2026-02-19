import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
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

        if (typeof window !== 'undefined') {
          // Try hash fragment first: #session_id=xxx or #/session_id=xxx
          const hash = window.location.hash || '';
          const hashMatch = hash.match(/session_id=([^&]+)/);
          if (hashMatch) {
            sessionId = decodeURIComponent(hashMatch[1]);
          }

          // Try query params: ?session_id=xxx
          if (!sessionId) {
            const searchParams = new URLSearchParams(window.location.search);
            sessionId = searchParams.get('session_id');
          }

          // Try full URL parsing as fallback
          if (!sessionId) {
            const fullUrl = window.location.href;
            const urlMatch = fullUrl.match(/session_id=([^&#]+)/);
            if (urlMatch) {
              sessionId = decodeURIComponent(urlMatch[1]);
            }
          }
        }

        if (sessionId) {
          const user = await login(sessionId);
          if (user) {
            router.replace('/(tabs)/home');
            return;
          }
        }
        
        // No session_id found or login failed
        router.replace('/');
      } catch (err) {
        console.error('Auth callback error:', err);
        router.replace('/');
      }
    };

    // Small delay to ensure URL is fully loaded
    setTimeout(processAuth, 300);
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
