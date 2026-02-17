import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, Image, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { Feather } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const SLUG_COLORS: Record<string, string> = {
  'first-aid': '#E63946',
  'finance': '#2A9D8F',
  'crisis-management': '#E36414',
  'civic-sense': '#0F4C5C',
  'safety-tips': '#FB8B24',
};

type Topic = {
  topic_id: string;
  category_slug: string;
  title: string;
  description: string;
  icon: string;
  tags: string[];
};

type Category = {
  category_id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  image_url: string;
  topic_count: number;
};

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategory();
  }, [slug]);

  const fetchCategory = async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/categories/${slug}`);
      if (resp.ok) {
        const data = await resp.json();
        setCategory(data.category);
        setTopics(data.topics);
      }
    } catch (e) {
      console.error('Fetch category error:', e);
    } finally {
      setLoading(false);
    }
  };

  const catColor = SLUG_COLORS[slug || ''] || colors.primary;

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
      {/* Header */}
      <View style={[styles.headerBanner, { backgroundColor: catColor }]}>
        {category?.image_url && (
          <Image source={{ uri: category.image_url }} style={styles.headerImage} />
        )}
        <View style={styles.headerOverlay} />
        <TouchableOpacity
          testID="category-back-btn"
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.iconBadge}>
            <Feather name={(category?.icon || 'book') as any} size={24} color="#FFF" />
          </View>
          <Text style={styles.headerTitle}>{category?.name}</Text>
          <Text style={styles.headerDesc}>{category?.description}</Text>
          <Text style={styles.topicCount}>
            {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
          </Text>
        </View>
      </View>

      {/* Topics List */}
      <FlatList
        data={topics}
        keyExtractor={(item) => item.topic_id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            testID={`topic-card-${item.topic_id}`}
            style={[styles.topicCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={() => router.push(`/topic/${item.topic_id}`)}
            activeOpacity={0.8}
          >
            <View style={[styles.topicNumber, { backgroundColor: catColor + '15' }]}>
              <Text style={[styles.topicNumberText, { color: catColor }]}>{index + 1}</Text>
            </View>
            <View style={styles.topicContent}>
              <Text style={[styles.topicTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.topicDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.description}
              </Text>
              <View style={styles.topicTags}>
                {item.tags.slice(0, 3).map((tag) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: catColor + '12' }]}>
                    <Text style={[styles.tagText, { color: catColor }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBanner: {
    height: 240,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  headerImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerContent: {
    padding: 20,
    paddingBottom: 24,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
  },
  headerDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 6,
    lineHeight: 20,
  },
  topicCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    marginTop: 8,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  topicNumber: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicNumberText: { fontSize: 16, fontWeight: '800' },
  topicContent: { flex: 1 },
  topicTitle: { fontSize: 15, fontWeight: '700' },
  topicDesc: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  topicTags: { flexDirection: 'row', marginTop: 6, gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: '600' },
});
