import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Image, Dimensions, Platform, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

const SLUG_COLORS: Record<string, string> = {
  'first-aid': '#E63946',
  'finance': '#2A9D8F',
  'crisis-management': '#E36414',
  'civic-sense': '#0F4C5C',
  'safety-tips': '#FB8B24',
};

type Video = {
  video_id: string;
  title: string;
  description: string;
  thumbnail: string;
  channel_title: string;
};

type Topic = {
  topic_id: string;
  category_slug: string;
  title: string;
  description: string;
  content: string;
  icon: string;
  tags: string[];
};

export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    fetchTopic();
    checkBookmark();
  }, [id]);

  const fetchTopic = async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/topics/${id}`);
      if (resp.ok) {
        const data = await resp.json();
        setTopic(data.topic);
        setVideos(data.videos || []);
        // Save to offline storage
        if (data.topic) {
          await AsyncStorage.setItem(`topic_${id}`, JSON.stringify(data));
        }
      }
    } catch (e) {
      // Try offline cache
      const cached = await AsyncStorage.getItem(`topic_${id}`);
      if (cached) {
        const data = JSON.parse(cached);
        setTopic(data.topic);
        setVideos(data.videos || []);
      }
    } finally {
      setLoading(false);
      setVideosLoading(false);
    }
  };

  const checkBookmark = async () => {
    if (!isAuthenticated) return;
    try {
      const token = await AsyncStorage.getItem('session_token');
      const resp = await fetch(`${BACKEND_URL}/api/bookmarks`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json();
        const found = (data.bookmarks || []).some((b: any) => b.topic_id === id);
        setIsBookmarked(found);
      }
    } catch {}
  };

  const toggleBookmark = async () => {
    if (!isAuthenticated) return;
    setBookmarkLoading(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (isBookmarked) {
        await fetch(`${BACKEND_URL}/api/bookmarks/${id}`, {
          method: 'DELETE',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          credentials: 'include',
        });
        setIsBookmarked(false);
      } else {
        await fetch(`${BACKEND_URL}/api/bookmarks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ topic_id: id }),
          credentials: 'include',
        });
        setIsBookmarked(true);
      }
    } catch (e) {
      console.error('Bookmark toggle error:', e);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const catColor = SLUG_COLORS[topic?.category_slug || ''] || colors.primary;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!topic) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingCenter}>
          <Feather name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>Topic not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          testID="topic-back-btn"
          style={[styles.topBarBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {isAuthenticated && (
          <TouchableOpacity
            testID="topic-bookmark-btn"
            style={[styles.topBarBtn, { backgroundColor: isBookmarked ? catColor : colors.surface, borderColor: isBookmarked ? catColor : colors.border }]}
            onPress={toggleBookmark}
            disabled={bookmarkLoading}
          >
            {bookmarkLoading ? (
              <ActivityIndicator size="small" color={isBookmarked ? '#FFF' : catColor} />
            ) : (
              <Feather name="bookmark" size={20} color={isBookmarked ? '#FFF' : colors.textPrimary} />
            )}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Topic Header */}
        <View style={styles.topicHeader}>
          <View style={[styles.catBadge, { backgroundColor: catColor + '15' }]}>
            <Text style={[styles.catBadgeText, { color: catColor }]}>
              {topic.category_slug.replace(/-/g, ' ').toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.topicTitle, { color: colors.textPrimary }]}>{topic.title}</Text>
          <Text style={[styles.topicDescription, { color: colors.textSecondary }]}>{topic.description}</Text>
          <View style={styles.tagRow}>
            {topic.tags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Content */}
        <View style={[styles.contentSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.contentHeader}>
            <View style={[styles.contentIcon, { backgroundColor: catColor }]}>
              <Feather name="file-text" size={16} color="#FFF" />
            </View>
            <Text style={[styles.contentLabel, { color: colors.textPrimary }]}>Guide</Text>
          </View>
          <Text style={[styles.contentText, { color: colors.textPrimary }]}>{topic.content}</Text>
        </View>

        {/* Videos Section */}
        <View style={styles.videosSection}>
          <View style={styles.videosSectionHeader}>
            <Feather name="play-circle" size={20} color={catColor} />
            <Text style={[styles.videosSectionTitle, { color: colors.textPrimary }]}>
              Video Guides
            </Text>
          </View>

          {videosLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
          ) : videos.length === 0 ? (
            <View style={[styles.noVideos, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="video-off" size={24} color={colors.textSecondary} />
              <Text style={[styles.noVideosText, { color: colors.textSecondary }]}>
                No video guides available yet
              </Text>
            </View>
          ) : (
            videos.map((video) => (
              <View
                key={video.video_id}
                testID={`video-card-${video.video_id}`}
                style={[styles.videoCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              >
                {playingVideoId === video.video_id ? (
                  <View style={styles.embedContainer}>
                    {Platform.OS === 'web' ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&rel=0`}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <WebView
                        source={{ uri: `https://www.youtube.com/embed/${video.video_id}?autoplay=1&rel=0` }}
                        style={{ flex: 1 }}
                        allowsFullscreenVideo
                        javaScriptEnabled
                        mediaPlaybackRequiresUserAction={false}
                      />
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.thumbnailContainer}
                    onPress={() => setPlayingVideoId(video.video_id)}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: video.thumbnail }} style={styles.thumbnail} />
                    <View style={styles.playOverlay}>
                      <View style={styles.playBtn}>
                        <Feather name="play" size={20} color="#FFF" />
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                <View style={styles.videoInfo}>
                  <Text style={[styles.videoTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {video.title}
                  </Text>
                  <Text style={[styles.videoChannel, { color: colors.textSecondary }]} numberOfLines={1}>
                    {video.channel_title}
                  </Text>
                  <Text style={[styles.videoDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {video.description}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontSize: 18, fontWeight: '700' },
  backLink: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  topBarBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  topicHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  catBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 12,
  },
  catBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  topicTitle: { fontSize: 26, fontWeight: '800', lineHeight: 32 },
  topicDescription: { fontSize: 15, marginTop: 8, lineHeight: 22 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  tagText: { fontSize: 12, fontWeight: '500' },
  contentSection: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  contentIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentLabel: { fontSize: 16, fontWeight: '700' },
  contentText: { fontSize: 15, lineHeight: 24 },
  videosSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  videosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  videosSectionTitle: { fontSize: 18, fontWeight: '800' },
  noVideos: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  noVideosText: { fontSize: 14 },
  videoCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
  },
  embedContainer: {
    width: '100%',
    height: 220,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(227,100,20,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3,
  },
  videoInfo: {
    padding: 14,
  },
  videoTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  videoChannel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  videoDesc: { fontSize: 13, marginTop: 6, lineHeight: 18 },
});
