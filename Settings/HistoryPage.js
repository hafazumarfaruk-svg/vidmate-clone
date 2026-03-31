import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const HISTORY_DATA = [
  { id: '1', title: 'আন্তর্জাতিক সীমান্তের বর্তমান পরিস্থিতি এবং সামরিক বিশ্লেষণ', channel: 'ATN Bangla News', views: '15K views', thumbnail: 'https://via.placeholder.com/300x170' },
  { id: '2', title: 'নতুন প্রযুক্তির বিস্ময়কর আবিষ্কার', channel: 'Tech Info', views: '1.2M views', thumbnail: 'https://via.placeholder.com/300x170' },
];

export default function HistoryPage() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Watch History</Text>
        <TouchableOpacity style={{ padding: 10 }}>
          <Ionicons name="search" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={HISTORY_DATA}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.historyCard}>
            <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
            <View style={styles.infoContainer}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.meta}>{item.channel} • {item.views}</Text>
            </View>
            <Ionicons name="ellipsis-vertical" size={18} color="#AAA" style={{ padding: 5 }} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { flexDirection: 'row', alignItems: 'center', height: 55, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { flex: 1, color: '#FFF', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  historyCard: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  thumbnail: { width: 140, height: 80, borderRadius: 8, backgroundColor: '#333' },
  infoContainer: { flex: 1, paddingLeft: 12, justifyContent: 'flex-start' },
  title: { color: '#FFF', fontSize: 14, fontWeight: '500', marginBottom: 5 },
  meta: { color: '#AAA', fontSize: 12 }
});