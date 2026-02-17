import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Image, RefreshControl, ActivityIndicator, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

type Category = {
  category_id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  image_url: string;
  topic_count: number;
};

const CATEGORY_COLORS: Record<string, string> = {
  'first-aid': '#E63946',
  'finance': '#2A9D8F',
  'crisis-management': '#E36414',
  'civic-sense': '#0F4C5C',
  'safety-tips': '#FB8B24',
};

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCategories = async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/categories`);
      if (resp.ok) {
        const data = await resp.json();
        setCategories(data);
      }
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCategories();
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {user ? `Hello, ${user.name.split(' ')[0]}` : 'Welcome to'}
            </Text>
            <Text style={[styles.appTitle, { color: colors.textPrimary }]}>knowNest</Text>
          </View>
          <TouchableOpacity
            testID="home-search-btn"
            style={[styles.searchIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/search')}
          >
            <Feather name="search" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Hero Banner */}
        <View style={[styles.heroBanner, { backgroundColor: colors.primary }]}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Knowledge is{'\n'}your superpower</Text>
            <Text style={styles.heroSubtitle}>
              Quick guides, video tutorials, and practical tips for everyday life
            </Text>
          </View>
          <View style={styles.heroIconContainer}>
            <Feather name="book-open" size={48} color="rgba(255,255,255,0.3)" />
          </View>
        </View>

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Categories</Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {categories.length} topics
          </Text>
        </View>

        <View style={styles.categoriesGrid}>
          {categories.map((cat, idx) => (
            <TouchableOpacity
              key={cat.category_id}
              testID={`category-card-${cat.slug}`}
              style={[
                styles.categoryCard,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
                idx % 2 === 0 ? { marginRight: 8 } : { marginLeft: 8 },
              ]}
              onPress={() => router.push(`/category/${cat.slug}`)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: cat.image_url }}
                style={styles.categoryImage}
              />
              <View style={[styles.categoryOverlay, { backgroundColor: CATEGORY_COLORS[cat.slug] || colors.primary }]} />
              <View style={styles.categoryContent}>
                <View style={styles.categoryIconBadge}>
                  <Feather name={cat.icon as any} size={18} color="#FFF" />
                </View>
                <Text style={styles.categoryName}>{cat.name}</Text>
                <Text style={styles.categoryTopicCount}>
                  {cat.topic_count} {cat.topic_count === 1 ? 'topic' : 'topics'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Access */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Access</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickAccessScroll}>
          {[
            { icon: 'activity', label: 'CPR Guide', id: 't_cpr', color: '#E63946' },
            { icon: 'zap', label: 'Self Defense', id: 't_self_defense', color: '#E36414' },
            { icon: 'lock', label: 'Cyber Safety', id: 't_cyber_safety', color: '#0F4C5C' },
            { icon: 'check-square', label: 'Voting', id: 't_voting', color: '#2A9D8F' },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              testID={`quick-access-${item.id}`}
              style={[styles.quickAccessCard, { backgroundColor: item.color }]}
              onPress={() => router.push(`/topic/${item.id}`)}
              activeOpacity={0.85}
            >
              <Feather name={item.icon as any} size={24} color="#FFF" />
              <Text style={styles.quickAccessLabel}>{item.label}</Text>
              <Feather name="arrow-right" size={16} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
  },
  appTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  searchIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  heroBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 8,
    lineHeight: 19,
  },
  heroIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  categoryCard: {
    width: (width - 48) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
  },
  categoryImage: {
    width: '100%',
    height: 100,
  },
  categoryOverlay: {
    ...StyleSheet.absoluteFillObject,
    height: 100,
    opacity: 0.45,
  },
  categoryContent: {
    padding: 14,
  },
  categoryIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -17,
    left: 14,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  categoryTopicCount: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.6,
  },
  quickAccessScroll: {
    paddingLeft: 20,
  },
  quickAccessCard: {
    width: 140,
    height: 120,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    justifyContent: 'space-between',
  },
  quickAccessLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
