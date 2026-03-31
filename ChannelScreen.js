import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, SafeAreaView, StatusBar, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

global.subscribedChannels = global.subscribedChannels || new Set();

const { width } = Dimensions.get('window');

export default function ChannelScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  
  const { channelName = 'YouTube Channel', channelAvatar = 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Circle-icons-profile.svg' } = route.params || {};

  const [activeTab, setActiveTab] = useState('Home');
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(global.subscribedChannels.has(channelName));
  const [channelBanner, setChannelBanner] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop');

  const [tabData, setTabData] = useState({
    Home: [], Videos: [], Shorts: [], Live: [], Playlists: [], Posts: []
  });

  useEffect(() => {
    fetchChannelData();
  }, [channelName]);

  const formatUrl = (url) => {
    if (!url) return 'https://upload.wikimedia.org/wikipedia/commons/e/e1/YouTube_play_buttom_icon_%282013-2017%29.svg';
    let validUrl = String(url);
    if (validUrl.startsWith('//')) return `https:${validUrl}`;
    return validUrl;
  };

  const extractChannelDataRecursively = (node, categorizedData) => {
    if (Array.isArray(node)) {
      node.forEach(child => extractChannelDataRecursively(child, categorizedData));
    } else if (node !== null && typeof node === 'object') {
      
      if (node.channelRenderer && node.channelRenderer.title?.simpleText?.includes(channelName)) {
        if (node.channelRenderer.tvBanner?.thumbnails?.[0]?.url) {
          setChannelBanner(node.channelRenderer.tvBanner.thumbnails[0].url);
        }
      }

      if (node.videoRenderer && node.videoRenderer.videoId) {
        const vid = node.videoRenderer;
        const duration = vid.lengthText?.simpleText || '';
        const isLive = vid.badges?.some(b => b.metadataBadgeRenderer?.label?.toUpperCase().includes('LIVE')) || duration === '';
        const isShort = /^(0:[0-5][0-9]|1:[0-5][0-9]|2:[0-2][0-9]|2:30)$/.test(duration);

        const parsedVid = {
          id: String(vid.videoId),
          title: String(vid.title?.runs?.[0]?.text || 'অজ্ঞাত শিরোনাম'),
          views: String(vid.viewCountText?.simpleText || vid.shortViewCountText?.simpleText || 'N/A'),
          time: String(vid.publishedTimeText?.simpleText || ''),
          duration: String(duration),
          thumbnail: formatUrl(vid.thumbnail?.thumbnails?.[0]?.url),
        };

        if (isLive) categorizedData.Live.push(parsedVid);
        else if (isShort) categorizedData.Shorts.push(parsedVid);
        else categorizedData.Videos.push(parsedVid);
        
        categorizedData.Home.push(parsedVid); 
      } 
      else if (node.reelItemRenderer && node.reelItemRenderer.videoId) {
        const parsedShort = {
          id: String(node.reelItemRenderer.videoId),
          title: String(node.reelItemRenderer.headline?.simpleText || 'Short Video'),
          views: String(node.reelItemRenderer.viewCountText?.simpleText || 'N/A'),
          thumbnail: formatUrl(node.reelItemRenderer.thumbnail?.thumbnails?.[0]?.url)
        };
        categorizedData.Shorts.push(parsedShort);
        categorizedData.Home.push(parsedShort);
      } 
      else {
        Object.values(node).forEach(child => extractChannelDataRecursively(child, categorizedData));
      }
    }
  };

  const fetchChannelData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(channelName)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'en-US,en;q=0.9' }
      });
      const htmlText = await response.text();
      const match = htmlText.match(/var ytInitialData = (.*?);<\/script>/);
      if (!match || !match[1]) throw new Error("ডেটা স্ট্রাকচার খুঁজে পাওয়া যায়নি।");
      const jsonData = JSON.parse(match[1]);

      const categorizedData = { Home: [], Videos: [], Shorts: [], Live: [], Playlists: [], Posts: [] };
      extractChannelDataRecursively(jsonData, categorizedData);
      setTabData(categorizedData);
    } catch (error) {
      console.error("চ্যানেল ডেটা ফেচিং এরর: ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionToggle = () => {
    if (isSubscribed) {
      global.subscribedChannels.delete(channelName);
      setIsSubscribed(false);
    } else {
      global.subscribedChannels.add(channelName);
      setIsSubscribed(true);
    }
  };

  const renderItem = ({ item, index }) => {
    if (activeTab === 'Shorts') {
      return (
        <TouchableOpacity style={styles.shortGridItem} activeOpacity={0.8} onPress={() => navigation.navigate('Player', { playlist: tabData.Shorts, initialIndex: index, isShorts: true })}>
          <Image source={{ uri: item.thumbnail }} style={styles.shortGridImage} />
          <View style={styles.shortViewsOverlay}>
            <Ionicons name="play-outline" size={14} color="#FFF" />
            <Text style={styles.shortViewsText}>{item.views}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return (
      <View style={styles.videoCard}>
        <TouchableOpacity style={styles.thumbnailContainer} activeOpacity={0.8} onPress={() => navigation.navigate('Player', { videoId: item.id })}>
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnailImage} />
          {item.duration ? <Text style={styles.durationBadge}>{item.duration}</Text> : null}
        </TouchableOpacity>
        <View style={styles.videoInfoContainer}>
          <TouchableOpacity style={styles.videoTextContainer} activeOpacity={0.8} onPress={() => navigation.navigate('Player', { videoId: item.id })}>
            <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.videoMeta}>{item.views} {item.time ? `• ${item.time}` : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingLeft: 10 }}>
            <Ionicons name="ellipsis-vertical" size={16} color="#AAA" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ChannelHeader = () => (
    <View>
      <Image source={{ uri: channelBanner }} style={styles.bannerImage} />
      <View style={styles.channelProfileSection}>
        <Image source={{ uri: channelAvatar }} style={styles.channelLogoLarge} />
        <View style={styles.channelTextInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.channelTitle}>{channelName}</Text>
            <Ionicons name="checkmark-circle" size={16} color="#AAA" style={{ marginLeft: 5, marginTop: 4 }} />
          </View>
          <Text style={styles.channelMeta}>@{(channelName).replace(/\s+/g, '').toLowerCase()} • {tabData.Home.length * 12}K subscribers</Text>
          <TouchableOpacity style={styles.descriptionRow}>
            <Text style={styles.channelDescription} numberOfLines={1}>Welcome to {channelName} Official Channel. <Text style={{ color: '#FFF' }}>...more</Text></Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={[styles.subscribeBtn, isSubscribed ? styles.subscribedState : styles.unsubscribedState]} onPress={handleSubscriptionToggle} activeOpacity={0.8}>
          <Ionicons name={isSubscribed ? "notifications-outline" : "notifications"} size={18} color={isSubscribed ? "#FFF" : "#0F0F0F"} />
          <Text style={[styles.subscribeText, isSubscribed ? {color: '#FFF'} : {color: '#0F0F0F'}]}>
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </Text>
          {isSubscribed && <Ionicons name="chevron-down" size={16} color="#FFF" />}
        </TouchableOpacity>
      </View>

      <View style={styles.tabScrollContainer}>
        <FlatList
          horizontal showsHorizontalScrollIndicator={false}
          data={['Home', 'Videos', 'Shorts', 'Live', 'Playlists', 'Posts']}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.tabButton, activeTab === item && styles.activeTabButton]} onPress={() => setActiveTab(item)}>
              <Text style={[styles.tabText, activeTab === item && styles.activeTabText]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading && (
        <View style={{ padding: 50, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FF0000" />
          <Text style={{ color: '#AAA', marginTop: 10 }}>চ্যানেল ডেটা প্রসেস হচ্ছে...</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#0F0F0F" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{channelName}</Text>
        <TouchableOpacity style={styles.headerIcon}><Ionicons name="search" size={22} color="#FFF" /></TouchableOpacity>
        <TouchableOpacity style={styles.headerIcon}><Ionicons name="ellipsis-vertical" size={22} color="#FFF" /></TouchableOpacity>
      </View>

      <FlatList
        key={activeTab === 'Shorts' ? 'grid-3' : 'list-1'}
        numColumns={activeTab === 'Shorts' ? 3 : 1}
        data={tabData[activeTab] || []}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.id + index.toString()}
        ListHeaderComponent={ChannelHeader}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={!loading && <Text style={styles.emptyText}>এই ট্যাবে বর্তমানে কোনো কন্টেন্ট নেই (API Constraint)।</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { flexDirection: 'row', alignItems: 'center', height: 50, paddingHorizontal: 10 },
  headerIcon: { padding: 10 },
  headerTitle: { flex: 1, color: '#FFF', fontSize: 18, fontWeight: 'bold', marginLeft: 5 },
  bannerImage: { width: width, height: width * 0.25, resizeMode: 'cover', backgroundColor: '#222' },
  channelProfileSection: { flexDirection: 'row', padding: 15, alignItems: 'center' },
  channelLogoLarge: { width: 70, height: 70, borderRadius: 35, marginRight: 15, backgroundColor: '#333' },
  channelTextInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  channelTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  channelMeta: { fontSize: 12, color: '#AAA', marginTop: 2, marginBottom: 8 },
  descriptionRow: { marginBottom: 4 },
  channelDescription: { fontSize: 12, color: '#AAA' },
  actionButtonsContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingBottom: 15 },
  subscribeBtn: { flex: 1, flexDirection: 'row', paddingVertical: 10, borderRadius: 20, justifyContent: 'center', alignItems: 'center', gap: 5 },
  subscribedState: { backgroundColor: '#272727' },
  unsubscribedState: { backgroundColor: '#F1F1F1' },
  subscribeText: { fontSize: 14, fontWeight: 'bold' },
  tabScrollContainer: { borderBottomWidth: 1, borderBottomColor: '#222' },
  tabButton: { paddingVertical: 15, paddingHorizontal: 20 },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: '#FFF' },
  tabText: { color: '#AAA', fontSize: 15, fontWeight: '500' },
  activeTabText: { color: '#FFF', fontWeight: 'bold' },
  videoCard: { marginBottom: 20, marginTop: 10 },
  thumbnailContainer: { width: '100%', height: 210, position: 'relative', backgroundColor: '#111' },
  thumbnailImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  durationBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', color: '#FFF', fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: 'bold' },
  videoInfoContainer: { flexDirection: 'row', padding: 12, alignItems: 'flex-start' },
  videoTextContainer: { flex: 1, paddingRight: 10 },
  videoTitle: { color: '#FFF', fontSize: 15, fontWeight: '500', marginBottom: 4, lineHeight: 20 },
  videoMeta: { color: '#AAA', fontSize: 12 },
  shortGridItem: { width: (width / 3) - 2, height: 220, margin: 1, position: 'relative', backgroundColor: '#222' },
  shortGridImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  shortViewsOverlay: { position: 'absolute', bottom: 5, left: 5, flexDirection: 'row', alignItems: 'center' },
  shortViewsText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginLeft: 3, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  emptyText: { color: '#AAA', textAlign: 'center', marginTop: 50, fontSize: 14 }
});