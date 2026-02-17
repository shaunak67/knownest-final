import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { Feather } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type Topic = {
  topic_id: string;
  category_slug: string;
  title: string;
  description: string;
  icon: string;
  tags: string[];
};

const SLUG_COLORS: Record<string, string> = {
  'first-aid': '#E63946',
  'finance': '#2A9D8F',
  'crisis-management': '#E36414',
  'civic-sense': '#0F4C5C',
  'safety-tips': '#FB8B24',
};

export default function SearchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setSearched(true);
      try {
        const resp = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(text)}`);
        if (resp.ok) {
          const data = await resp.json();
          setResults(data.results || []);
        }
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const renderItem = ({ item }: { item: Topic }) => {
    const catColor = SLUG_COLORS[item.category_slug] || colors.primary;
    return (
      <TouchableOpacity
        testID={`search-result-${item.topic_id}`}
        style={[styles.resultCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => router.push(`/topic/${item.topic_id}`)}
        activeOpacity={0.8}
      >
        <View style={[styles.resultIcon, { backgroundColor: catColor }]}>
          <Feather name={item.icon as any} size={18} color="#FFF" />
        </View>
        <View style={styles.resultContent}>
          <Text style={[styles.resultTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.resultDesc, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.tagRow}>
            {item.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: catColor + '15' }]}>
                <Text style={[styles.tagText, { color: catColor }]}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const suggestions = ['CPR', 'Taxes', 'Self Defense', 'Voting', 'Fire Safety', 'Cyber Safety'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.headerArea}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Search</Text>
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="search" size={20} color={colors.textSecondary} />
            <TextInput
              testID="search-input"
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search topics, guides..."
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={handleSearch}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity testID="search-clear-btn" onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
                <Feather name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !searched ? (
          <View style={styles.suggestionsArea}>
            <Text style={[styles.suggestLabel, { color: colors.textSecondary }]}>Popular searches</Text>
            <View style={styles.suggestionsGrid}>
              {suggestions.map((s) => (
                <TouchableOpacity
                  key={s}
                  testID={`suggestion-${s.toLowerCase().replace(/\s/g, '-')}`}
                  style={[styles.suggestionChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleSearch(s)}
                >
                  <Feather name="trending-up" size={14} color={colors.secondary} />
                  <Text style={[styles.suggestionText, { color: colors.textPrimary }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.centerContent}>
            <Feather name="search" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No results found for "{query}"
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.topic_id}
            renderItem={renderItem}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
  },
  suggestionsArea: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  suggestLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultsList: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  resultDesc: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
