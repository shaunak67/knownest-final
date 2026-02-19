import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image, Platform, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogin = () => {
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

  const themeModes: { key: 'light' | 'dark' | 'system'; icon: string; label: string }[] = [
    { key: 'light', icon: 'sun', label: 'Light' },
    { key: 'dark', icon: 'moon', label: 'Dark' },
    { key: 'system', icon: 'smartphone', label: 'System' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Profile</Text>
        </View>

        {!isAuthenticated ? (
          <View style={styles.guestSection}>
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
        ) : (
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
        )}

        {/* Theme Toggle */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>APPEARANCE</Text>
        </View>
        <View style={[styles.themeToggleContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {themeModes.map((mode) => {
            const isActive = themeMode === mode.key;
            return (
              <TouchableOpacity
                key={mode.key}
                testID={`theme-toggle-${mode.key}`}
                style={[
                  styles.themeOption,
                  isActive && { backgroundColor: colors.primary },
                ]}
                onPress={() => setThemeMode(mode.key)}
                activeOpacity={0.7}
              >
                <Feather
                  name={mode.icon as any}
                  size={18}
                  color={isActive ? '#FFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: isActive ? '#FFF' : colors.textSecondary },
                  ]}
                >
                  {mode.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Menu Items */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>NAVIGATION</Text>
        </View>
        <View style={[styles.menuSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            { icon: 'bookmark', label: 'Saved Topics', action: () => router.push('/(tabs)/bookmarks') },
            { icon: 'search', label: 'Search Topics', action: () => router.push('/(tabs)/search') },
            { icon: 'info', label: 'About KnowNest', action: () => {} },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              testID={`profile-menu-${item.label.toLowerCase().replace(/\s/g, '-')}`}
              style={[
                styles.menuItem,
                { borderBottomColor: colors.border },
                i === arr.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={item.action}
            >
              <Feather name={item.icon as any} size={20} color={colors.textSecondary} />
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{item.label}</Text>
              <Feather name="chevron-right" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {isAuthenticated && (
          <TouchableOpacity
            testID="logout-btn"
            style={[styles.logoutBtn, { borderColor: colors.error }]}
            onPress={handleLogout}
          >
            <Feather name="log-out" size={18} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  guestSection: {
    alignItems: 'center',
    paddingVertical: 40,
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
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  themeToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuSection: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
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
