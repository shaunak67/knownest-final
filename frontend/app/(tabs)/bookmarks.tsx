import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type Bookmark = {
  bookmark_id: string;
  topic_id: string;
  created_at: string;
  topic: {
    topic_id: string;
    category_slug: string;
    title: string;
    description: string;
    icon: string;
    tags: string[];
  } | null;
};

const SLUG_COLORS: Record<string, string> = {
  'first-aid': '#E63946',
  'finance': '#2A9D8F',
  'crisis-management': '#E36414',
  'civic-sense': '#0F4C5C',
  'safety-tips': '#FB8B24',
};

export default function BookmarksScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [offlineTopics, setOfflineTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookmarks = async () => {
    try {
      if (isAuthenticated) {
        const token = await AsyncStorage.getItem('session_token');
        const resp = await fetch(`${BACKEND_URL}/api/bookmarks`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          credentials: 'include',
        });
        if (resp.ok) {
          const data = await resp.json();
          setBookmarks(data.bookmarks || []);
          // Save to offline storage
          await AsyncStorage.setItem('offline_bookmarks', JSON.stringify(data.bookmarks || []));
        }
      }
      // Also load offline topics
      const offlineData = await AsyncStorage.getItem('offline_bookmarks');
      if (offlineData) {
        setOfflineTopics(JSON.parse(offlineData));
      }
    } catch {
      // Try loading from offline cache
      const offlineData = await AsyncStorage.getItem('offline_bookmarks');
      if (offlineData) {
        setOfflineTopics(JSON.parse(offlineData));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBookmarks();
    }, [isAuthenticated])
  );

  const handleRemoveBookmark = async (topicId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      await fetch(`${BACKEND_URL}/api/bookmarks/${topicId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      });
      setBookmarks((prev) => prev.filter((b) => b.topic_id !== topicId));
    } catch (e) {
      console.error('Remove bookmark error:', e);
    }
  };

  const displayItems = isAuthenticated ? bookmarks : offlineTopics;

  const renderItem = ({ item }: { item: Bookmark }) => {
    const topic = item.topic;
    if (!topic) return null;
    const catColor = SLUG_COLORS[topic.category_slug] || colors.primary;
    return (
      <TouchableOpacity
        testID={`bookmark-${topic.topic_id}`}
        style={[styles.bookmarkCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => router.push(`/topic/${topic.topic_id}`)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconBox, { backgroundColor: catColor }]}>
          <Feather name={topic.icon as any} size={20} color="#FFF" />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {topic.title}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
            {topic.description}
          </Text>
        </View>
        {isAuthenticated && (
          <TouchableOpacity
            testID={`remove-bookmark-${topic.topic_id}`}
            style={styles.removeBtn}
            onPress={() => handleRemoveBookmark(topic.topic_id)}
          >
            <Feather name="x" size={18} color={colors.error} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Saved</Text>
        {displayItems.length > 0 && (
          <Text style={[styles.count, { color: colors.textSecondary }]}>
            {displayItems.length} {displayItems.length === 1 ? 'topic' : 'topics'}
          </Text>
        )}
      </View>

      {!isAuthenticated ? (
        <View style={styles.emptyCenter}>
          <Feather name="lock" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Sign in to save topics
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Bookmark topics to access them anytime, even offline
          </Text>
          <TouchableOpacity
            testID="bookmarks-login-btn"
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/')}
          >
            <Text style={styles.loginBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : displayItems.length === 0 ? (
        <View style={styles.emptyCenter}>
          <Feather name="bookmark" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No saved topics yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Tap the bookmark icon on any topic to save it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) => item.bookmark_id || item.topic_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookmarks(); }} tintColor={colors.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800' },
  count: { fontSize: 13, fontWeight: '500' },
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyDesc: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  loginBtn: {
    marginTop: 20,
    height: 48,
    borderRadius: 9999,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  bookmarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardDesc: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  removeBtn: { padding: 8 },
});
