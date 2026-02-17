import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  SafeAreaView, Dimensions, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>  
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const origin = Platform.OS === 'web' ? window.location.origin : process.env.EXPO_PUBLIC_BACKEND_URL;
    const redirectUrl = `${origin}/auth-callback`;
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    } else {
      const { openBrowserAsync } = require('expo-web-browser');
      openBrowserAsync(authUrl);
    }
  };

  const handleSkipLogin = () => {
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primary }]}>
      <View style={styles.topSection}>
        <View style={styles.logoContainer}>
          <Image source={require('../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
        </View>
      </View>

      <View style={[styles.bottomSection, { backgroundColor: colors.background }]}>
        <View style={styles.featureRow}>
          <View style={styles.featureItem}>
            <Feather name="heart" size={22} color={colors.secondary} />
            <Text style={[styles.featureText, { color: colors.textPrimary }]}>First Aid</Text>
          </View>
          <View style={styles.featureItem}>
            <Feather name="dollar-sign" size={22} color={colors.secondary} />
            <Text style={[styles.featureText, { color: colors.textPrimary }]}>Finance</Text>
          </View>
          <View style={styles.featureItem}>
            <Feather name="shield" size={22} color={colors.secondary} />
            <Text style={[styles.featureText, { color: colors.textPrimary }]}>Safety</Text>
          </View>
        </View>

        <TouchableOpacity
          testID="google-login-btn"
          style={styles.googleButton}
          onPress={handleGoogleLogin}
          activeOpacity={0.85}
        >
          <Image
            source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }}
            style={styles.googleIcon}
          />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="skip-login-btn"
          style={[styles.skipButton, { borderColor: colors.border }]}
          onPress={handleSkipLogin}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
            Browse without signing in
          </Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
          Sign in to bookmark topics and access them offline
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoImage: {
    width: 220,
    height: 220,
  },
  bottomSection: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  featureItem: {
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    height: 56,
    borderRadius: 9999,
    paddingHorizontal: 24,
    marginBottom: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  googleIcon: {
    width: 22,
    height: 22,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  skipButton: {
    height: 48,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
  },
});
