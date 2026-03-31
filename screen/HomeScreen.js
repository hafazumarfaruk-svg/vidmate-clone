import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, SafeAreaView, StatusBar, TextInput, ActivityIndicator, Platform, Keyboard, Dimensions, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as NavigationBar from 'expo-navigation-bar';

import SettingsScreen from '../Settings/SettingsScreen';
import ShortsScreen from './ShortsScreen'; 

const USER_AGENT = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";
const DESKTOP_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FEED_TOPICS = [
  "trending bangladesh", "bangla natok 2026", "bangla new song", 
  "somoy tv live", "cricket highlights", "bangla waz short", 
  "tech review bangladesh", "funny video comedy bangla", "latest gojol 2026"
];

global.aiMemory = global.aiMemory || {};

export default function HomeScreen({ route }) {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('Home');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedShortId, setSelectedShortId] = useState(null);

  const [subscribedChannels, setSubscribedChannels] = useState([
    { id: '1', name: 'Jamuna TV', avatar: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Circle-icons-profile.svg' },
    { id: '2', name: 'Somoy TV', avatar: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Circle-icons-profile.svg' }
  ]);

  const getAlgorithmicTopic = () => {
    if (subscribedChannels.length > 0 && Math.random() < 0.70) {
        return subscribedChannels[Math.floor(Math.random() * subscribedChannels.length)].name;
    } else {
        return FEED_TOPICS[Math.floor(Math.random() * FEED_TOPICS.length)];
    }
  };

  const [activeQuery, setActiveQuery] = useState(getAlgorithmicTopic());

  useEffect(() => {
    if (route?.params?.executeSearch) {
        setActiveTab('Home'); setSearchQuery(route.params.executeSearch); setActiveQuery(route.params.executeSearch);
        const query = route.params.executeSearch.toLowerCase();
        global.aiMemory[query] = (global.aiMemory[query] || 1) + 2.0;
    }
    if (route?.params?.targetTab) setActiveTab(route.params.targetTab);
  }, [route?.params]);

  useEffect(() => {
    fetchRealVideos(activeQuery, true);
    if (Platform.OS === 'android') NavigationBar.setVisibilityAsync("hidden");
  }, [activeQuery]);

  const getHighQualityThumbnail = (thumbnailObj) => {
    if (!thumbnailObj || !thumbnailObj.thumbnails || thumbnailObj.thumbnails.length === 0) return 'https://via.placeholder.com/600x400';
    let bestImgUrl = thumbnailObj.thumbnails[thumbnailObj.thumbnails.length - 1].url;
    return bestImgUrl.startsWith('//') ? 'https:' + bestImgUrl : bestImgUrl;
  };

  const formatViews = (viewText) => {
    if (!viewText) return 'N/A';
    if (viewText.includes('K') || viewText.includes('M') || viewText.includes('B')) return viewText; 
    const numMatch = viewText.match(/[\d,]+/);
    if (!numMatch) return viewText;
    const num = parseInt(numMatch[0].replace(/,/g, ''), 10);
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B views';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M views';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K views';
    return num + ' views';
  };

  const fetchRealVideos = async (query, isNewSearch = false) => {
    if (isNewSearch) { setLoading(true); setVideos([]); }
    try {
      const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': DESKTOP_AGENT, 'Accept-Language': 'en-US,en;q=0.9' }
      });
      const htmlText = await response.text();
      
      let match = htmlText.match(/ytInitialData\s*=\s*({.+?});/);
      if (!match) match = htmlText.match(/var ytInitialData = (.*?);<\/script>/);
      if (!match) match = htmlText.match(/window\["ytInitialData"\]\s*=\s*({.+?});/);
      
      if (match && match[1]) {
        const jsonData = JSON.parse(match[1]);
        const extracted = [];
        const extractNodes = (node) => {
          if (Array.isArray(node)) node.forEach(extractNodes);
          else if (node && typeof node === 'object') {
            if (node.videoRenderer) extracted.push(node.videoRenderer);
            else Object.values(node).forEach(extractNodes);
          }
        };
        extractNodes(jsonData);
        
        const formatted = extracted.map(vid => {
          const rawViews = vid.shortViewCountText?.simpleText || vid.viewCountText?.simpleText || 'N/A';
          return {
            id: vid.videoId, title: vid.title?.runs?.[0]?.text || 'No Title', channel: vid.ownerText?.runs?.[0]?.text || 'Channel',
            views: formatViews(rawViews), duration: vid.lengthText?.simpleText || '', publishedTime: vid.publishedTimeText?.simpleText || '',
            thumbnail: getHighQualityThumbnail(vid.thumbnail), avatar: getHighQualityThumbnail(vid.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail)
          };
        });
        setVideos(isNewSearch ? formatted : [...videos, ...formatted]);
      }
    } catch (e) { console.error("Fetch Error:", e); } 
    finally { setLoading(false); setRefreshing(false); }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) { 
        setActiveTab('Home'); setActiveQuery(searchQuery); Keyboard.dismiss(); 
    }
  };

  const handleHomeTabPress = () => {
    setActiveTab('Home'); setSearchQuery(''); Keyboard.dismiss();
    setActiveQuery(getAlgorithmicTopic());
  };

  const handleShortsTabPress = () => {
    setSelectedShortId(null); 
    setActiveTab('Shorts');
  };

  const handleVideoPress = (item) => {
    const title = (item.title || "").toLowerCase();
    const isShortByTitle = title.includes('short') || title.includes('শর্ট');

    if (isShortByTitle) {
        setSelectedShortId(item.id); 
        setActiveTab('Shorts');     
    } else {
        navigation.navigate('Player', { videoId: item.id, videoData: item });
    }
  };

  // =========================================================
  // নতুন ফাংশন: চ্যানেল লোগোতে চাপ দিলে ChannelScreen এ যাবে
  // =========================================================
  const handleChannelPress = (item) => {
    // AI মেমরিতে চ্যানেলের পয়েন্ট বাড়ানো হলো
    const channelName = item.channel.toLowerCase();
    global.aiMemory[channelName] = (global.aiMemory[channelName] || 1) + 2.0;
    
    // ChannelScreen এ নেভিগেট করা হলো
    navigation.navigate('Channel', { channelData: item });
  };

  const toggleSubscription = (channelName, avatarUrl) => {
    const isSubscribed = subscribedChannels.some(sub => sub.name === channelName);
    if (isSubscribed) setSubscribedChannels(subscribedChannels.filter(sub => sub.name !== channelName));
    else setSubscribedChannels([...subscribedChannels, { id: Date.now().toString(), name: channelName, avatar: avatarUrl }]);
  };

  const handleUnsubscribe = (id) => {
    setSubscribedChannels(subscribedChannels.filter(sub => sub.id !== id));
  };

  const renderVideoItem = ({ item }) => {
    const isSubscribed = subscribedChannels.some(sub => sub.name === item.channel);
    return (
      <View style={styles.videoCard}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => handleVideoPress(item)}>
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
          {item.duration ? <View style={styles.durationBadge}><Text style={styles.durationText}>{item.duration}</Text></View> : null}
        </TouchableOpacity>
        
        <View style={styles.videoInfo}>
          {/* =========================================================
              এখানে চ্যানেল লোগোর ওপর TouchableOpacity যুক্ত করা হলো
          ========================================================= */}
          <TouchableOpacity activeOpacity={0.8} onPress={() => handleChannelPress(item)}>
            <Image source={{ uri: item.avatar }} style={styles.channelAvatar} />
          </TouchableOpacity>
          
          <View style={styles.textContainer}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => handleVideoPress(item)}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            </TouchableOpacity>
            
            {/* চ্যানেলের নামের ওপরে চাপ দিলেও চ্যানেলে যাবে */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => handleChannelPress(item)}>
              <Text style={styles.meta}>{item.channel} • {item.views} {item.publishedTime ? `• ${item.publishedTime}` : ''}</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={[styles.nativeSubBtn, isSubscribed && styles.nativeSubbedBtn]} onPress={() => toggleSubscription(item.channel, item.avatar)}>
            <Text style={[styles.nativeSubText, isSubscribed && styles.nativeSubbedText]}>{isSubscribed ? 'Subscribed' : 'Subscribe'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const MeMenuItem = ({ icon, text, onPress }) => (
    <TouchableOpacity style={styles.meMenuItem} onPress={onPress}>
      <Ionicons name={icon} size={24} color="#00BFA5" style={styles.meMenuIcon} />
      <Text style={styles.meMenuText}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#0F0F0F" barStyle="light-content" translucent={true} />
      
      {activeTab !== 'Shorts' && activeTab !== 'YoutubeWeb' && activeTab !== 'ME' && activeTab !== 'Settings' && activeTab !== 'Subscriptions' && (
        <View style={styles.header}>
          <View style={styles.logoContainer}>
             <Ionicons name="logo-youtube" size={28} color="#FF0000" />
             <Text style={styles.logoText}>MyTube</Text>
          </View>
          <View style={styles.searchBar}>
            <TextInput style={styles.input} placeholder="সার্চ করুন..." placeholderTextColor="#888" value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} />
            <TouchableOpacity onPress={handleSearch}><Ionicons name="search" size={18} color="#AAA" /></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setActiveTab('YoutubeWeb')} style={styles.profileBtn}>
            <Ionicons name="person-circle" size={32} color="#AAA" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.mainContent}>
        {activeTab === 'Home' ? (
          loading ? (
            <ActivityIndicator size="large" color="#FF0000" style={{ flex: 1, justifyContent: 'center' }} />
          ) : videos.length === 0 ? (
            <View style={styles.errorContainer}>
                <Ionicons name="cloud-offline-outline" size={60} color="#555" />
                <Text style={styles.errorText}>ভিডিও লোড করতে সমস্যা হচ্ছে।</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => fetchRealVideos(activeQuery, true)}><Text style={styles.retryText}>আবার চেষ্টা করুন</Text></TouchableOpacity>
            </View>
          ) : (
            <FlatList 
              data={videos} renderItem={renderVideoItem} keyExtractor={(item, index) => item.id + index.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); if(searchQuery.trim() === '') { setActiveQuery(getAlgorithmicTopic()); } else { fetchRealVideos(activeQuery, true); } }} tintColor="#FF0000" />}
            />
          )
        ) : activeTab === 'Shorts' ? (
          <ShortsScreen initialVideoId={selectedShortId} />
        ) : activeTab === 'YoutubeWeb' ? (
          <View style={{ flex: 1 }}>
             <View style={styles.webHeader}>
                <TouchableOpacity onPress={() => setActiveTab('Home')} style={{padding: 10}}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
                <Text style={{color: '#FFF', fontSize: 16, fontWeight: 'bold'}}>Login</Text>
             </View>
             <WebView source={{ uri: "https://accounts.google.com/ServiceLogin?service=youtube&continue=https://m.youtube.com" }} userAgent={USER_AGENT} javaScriptEnabled={true} domStorageEnabled={true} sharedCookiesEnabled={true} />
          </View>
        ) : activeTab === 'ME' ? (
          <View style={styles.meContainer}>
             <View style={styles.meHeaderProfile}>
                 <Ionicons name="person-circle" size={80} color="#555" />
                 <Text style={styles.meName}>MyTube User</Text>
                 <Text style={styles.meEmail}>Manage your account</Text>
             </View>
             <View style={styles.meMenuWrapper}>
                 <MeMenuItem icon="time-outline" text="HISTORY" onPress={() => console.log('History Clicked')} />
                 <MeMenuItem icon="download-outline" text="DOWNLOAD" onPress={() => console.log('Download Clicked')} />
                 <MeMenuItem icon="notifications-outline" text="MY SUBSCRIBE" onPress={() => setActiveTab('Subscriptions')} />
                 <MeMenuItem icon="settings-outline" text="SETTINGS" onPress={() => setActiveTab('Settings')} />
                 <MeMenuItem icon="mail-outline" text="SUPPORT TO GMAIL" onPress={() => console.log('Support Clicked')} />
             </View>
          </View>
        ) : activeTab === 'Settings' ? (
          <SettingsScreen />
        ) : activeTab === 'Subscriptions' ? (
          <View style={styles.subsContainer}>
             <View style={styles.webHeader}>
                <TouchableOpacity onPress={() => setActiveTab('ME')} style={{padding: 10}}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
                <Text style={{color: '#FFF', fontSize: 16, fontWeight: 'bold'}}>My Subscriptions</Text>
             </View>
             {subscribedChannels.length === 0 ? (
                <View style={styles.errorContainer}>
                   <Ionicons name="sad-outline" size={60} color="#555" />
                   <Text style={styles.errorText}>You have no subscriptions yet.</Text>
                </View>
             ) : (
                <FlatList 
                   data={subscribedChannels} keyExtractor={(item) => item.id}
                   renderItem={({item}) => (
                      <View style={styles.subItemCard}>
                         <Image source={{uri: item.avatar}} style={styles.subAvatar} />
                         <Text style={styles.subNameText} numberOfLines={1}>{item.name}</Text>
                         <TouchableOpacity style={styles.unsubBtn} onPress={() => handleUnsubscribe(item.id)}>
                             <Text style={styles.unsubBtnText}>Unsubscribe</Text>
                         </TouchableOpacity>
                      </View>
                   )}
                />
             )}
          </View>
        ) : null}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity onPress={handleHomeTabPress} style={styles.tab}>
            <Ionicons name={activeTab==='Home'?'home':'home-outline'} size={24} color={activeTab==='Home'?'#FFF':'#888'} />
            <Text style={[styles.tabText, activeTab==='Home' && {color:'#FFF'}]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShortsTabPress} style={styles.tab}>
            <Ionicons name={activeTab==='Shorts'?'play-circle':'play-circle-outline'} size={24} color={activeTab==='Shorts'?'#FFF':'#888'} />
            <Text style={[styles.tabText, activeTab==='Shorts' && {color:'#FFF'}]}>Shorts</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('ME')} style={styles.tab}>
            <Ionicons name={(activeTab==='ME' || activeTab==='Settings' || activeTab==='Subscriptions') ? 'person' : 'person-outline'} size={24} color={(activeTab==='ME' || activeTab==='Settings' || activeTab==='Subscriptions') ? '#FFF' : '#888'} />
            <Text style={[styles.tabText, (activeTab==='ME' || activeTab==='Settings' || activeTab==='Subscriptions') && {color:'#FFF'}]}>ME</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222', width: '100%' },
  logoContainer: { flexDirection: 'row', alignItems: 'center', width: 105 },
  logoText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 4, letterSpacing: -0.5 },
  searchBar: { flex: 1, flexDirection: 'row', backgroundColor: '#222', borderRadius: 20, marginHorizontal: 8, paddingHorizontal: 12, alignItems: 'center', height: 38 },
  input: { flex: 1, color: '#FFF', fontSize: 14, padding: 0 },
  profileBtn: { padding: 2, marginLeft: 4 },
  webHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F0F0F', paddingVertical: 5, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#222' },
  mainContent: { flex: 1 },
  videoCard: { marginBottom: 15 },
  thumbnail: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#111' },
  durationBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0, 0, 0, 0.8)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  durationText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  videoInfo: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  channelAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12, backgroundColor: '#333' },
  textContainer: { flex: 1, paddingRight: 10 },
  title: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  meta: { color: '#AAA', fontSize: 12, marginTop: 4 },
  nativeSubBtn: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, marginLeft: 5 },
  nativeSubText: { color: '#000', fontSize: 12, fontWeight: 'bold' },
  nativeSubbedBtn: { backgroundColor: '#222' },
  nativeSubbedText: { color: '#FFF' },
  tabBar: { flexDirection: 'row', height: 60, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#0F0F0F' },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabText: { fontSize: 10, color: '#888', marginTop: 4 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#888', marginTop: 10, fontSize: 14 },
  retryBtn: { marginTop: 15, paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#222', borderRadius: 20, borderWidth: 1, borderColor: '#444' },
  retryText: { color: '#FFF', fontWeight: 'bold' },
  meContainer: { flex: 1, backgroundColor: '#0F0F0F' },
  meHeaderProfile: { alignItems: 'center', marginTop: 40, marginBottom: 30 },
  meName: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  meEmail: { color: '#AAA', fontSize: 14, marginTop: 4 },
  meMenuWrapper: { paddingHorizontal: 20 },
  meMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#222' },
  meMenuIcon: { marginRight: 20 },
  meMenuText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  subsContainer: { flex: 1, backgroundColor: '#0F0F0F' },
  subItemCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  subAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#333' },
  subNameText: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: '500' },
  unsubBtn: { backgroundColor: '#333', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  unsubBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' }
});