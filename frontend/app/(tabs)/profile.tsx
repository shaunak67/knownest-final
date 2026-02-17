import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const origin = Platform.OS === 'web' ? window.location.origin : process.env.EXPO_PUBLIC_BACKEND_URL;
    const redirectUrl = `${origin}/auth-callback`;
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Profile</Text>
        </View>
        <View style={styles.emptyCenter}>
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
            <Feather name="user" size={40} color={colors.textSecondary} />
          </View>
          <Text style={[styles.guestTitle, { color: colors.textPrimary }]}>Guest Mode</Text>
          <Text style={[styles.guestDesc, { color: colors.textSecondary }]}>
            Sign in to save bookmarks and personalize your experience
          </Text>
          <TouchableOpacity
            testID="profile-login-btn"
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={handleLogin}
          >
            <Text style={styles.loginBtnText}>Sign in with Google</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Profile</Text>
      </View>

      <View style={styles.profileSection}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitial}>
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </Text>
          )}
        </View>
        <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.name}</Text>
        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
      </View>

      <View style={styles.menuSection}>
        {[
          { icon: 'bookmark', label: 'Saved Topics', action: () => router.push('/(tabs)/bookmarks') },
          { icon: 'search', label: 'Search Topics', action: () => router.push('/(tabs)/search') },
          { icon: 'info', label: 'About KnowNest', action: () => {} },
        ].map((item, i) => (
          <TouchableOpacity
            key={item.label}
            testID={`profile-menu-${item.label.toLowerCase().replace(/\s/g, '-')}`}
            style={[
              styles.menuItem,
              { borderBottomColor: colors.border },
              i === 2 && { borderBottomWidth: 0 },
            ]}
            onPress={item.action}
          >
            <Feather name={item.icon as any} size={20} color={colors.textSecondary} />
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{item.label}</Text>
            <Feather name="chevron-right" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        testID="logout-btn"
        style={[styles.logoutBtn, { borderColor: colors.error }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={18} color={colors.error} />
        <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800' },
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  guestDesc: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  loginBtn: {
    marginTop: 24,
    height: 50,
    borderRadius: 9999,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarInitial: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  userName: { fontSize: 22, fontWeight: '700', marginTop: 14 },
  userEmail: { fontSize: 14, marginTop: 4 },
  menuSection: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    gap: 14,
  },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 32,
    height: 50,
    borderRadius: 9999,
    borderWidth: 1.5,
    gap: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },
});
