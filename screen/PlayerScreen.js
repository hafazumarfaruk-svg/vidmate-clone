import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, StatusBar, FlatList, Image, ActivityIndicator, Dimensions, BackHandler, TouchableWithoutFeedback, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const USER_AGENT = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";
const { width, height } = Dimensions.get('window');

export default function PlayerScreen({ route, navigation }) {
  const { videoId, videoData = {} } = route?.params || {};
  
  const [loading, setLoading] = useState(true);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const webViewRef = useRef(null); 
  let controlsTimeout = useRef(null);

  const isShorts = videoData?.duration && videoData.duration.includes(':') && parseInt(videoData.duration.split(':')[0]) < 2;

  const videoUrl = `https://m.youtube.com/watch?v=${videoId}`;

  const getNormalConfig = () => {
      const quality = global.appSettings?.normalVideo || 'Normal Video Quality';
      if (quality === 'Anti Data Saver Mode') {
          return { userAgent: "Mozilla/5.0 (Mobile; LYF/F220B/LYF-F220B-000-01-28-290819; Android; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5", qualityMode: "tiny" };
      } else if (quality === 'Low Video Quality') {
          return { userAgent: "Mozilla/5.0 (Linux; Android 10; Nokia C1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.0.0 Mobile Safari/537.36", qualityMode: "small" };
      } else if (quality === 'High Video Quality') {
          return { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36", qualityMode: "hd1080" };
      } else {
          return { userAgent: "Mozilla/5.0 (Linux; Android 11; SM-A105F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.0.0 Mobile Safari/537.36", qualityMode: "medium" };
      }
  };

  const currentConfig = getNormalConfig();

  useEffect(() => {
    let timer = setTimeout(() => {
      setLoading(false);
      if (webViewRef.current) {
         webViewRef.current.injectJavaScript(`
            let v = document.querySelector('video');
            if(v && v.paused) { v.play().catch(e=>console.log(e)); }
            true;
         `);
      }
    }, 4000); 
    return () => clearTimeout(timer);
  }, [videoId]);

  useEffect(() => {
    const backAction = () => {
      if (isFullScreen) {
        setIsFullScreen(false);
        return true; 
      }
      return false; 
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isFullScreen]);

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => { setShowControls(false); }, 3500);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => { if (controlsTimeout.current) clearTimeout(controlsTimeout.current); }
  }, []);

  // =========================================================
  // অ্যাকশন বাটন লজিক (Share, Download, Background Audio)
  // =========================================================
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this video: https://www.youtube.com/watch?v=${videoId}`,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  const handleDownload = () => {
    navigation.navigate('DownloadScreen', { videoId: videoId, videoData: videoData });
  };

  const handleBackgroundAudio = () => {
    alert("ব্যাকগ্রাউন্ড অডিও মোড অন করা হয়েছে। স্ক্রিন বন্ধ করলেও অডিও চলবে।");
    webViewRef.current?.injectJavaScript(`
      let v = document.querySelector('video');
      if(v) v.play();
      true;
    `);
  };

  const injectScript = `
    try {
        window.localStorage.setItem('yt-player-quality', JSON.stringify({
            "data": "${currentConfig.qualityMode}", "expiration": Date.now() + 86400000, "creation": Date.now()
        }));
    } catch(e) {}

    const observer = new MutationObserver(() => {
        let videoElement = document.querySelector('video');
        
        if (videoElement) {
            videoElement.style.setProperty('position', 'fixed', 'important');
            videoElement.style.setProperty('top', '0', 'important');
            videoElement.style.setProperty('left', '0', 'important');
            
            videoElement.style.setProperty('width', '100%', 'important');
            videoElement.style.setProperty('height', '100%', 'important');
            videoElement.style.setProperty('z-index', '2147483647', 'important'); 
            videoElement.style.setProperty('object-fit', 'contain', 'important');
            videoElement.style.setProperty('background-color', '#000', 'important');
            videoElement.style.setProperty('pointer-events', 'auto', 'important');

            videoElement.style.setProperty('transform', 'none', 'important');
            videoElement.style.setProperty('margin', '0', 'important');
            videoElement.style.setProperty('padding', '0', 'important');
            videoElement.style.setProperty('box-sizing', 'border-box', 'important');

            videoElement.muted = false;
        }

        let unmuteBtn = document.querySelector('.ytp-unmute, .ytm-unmute, button[aria-label*="unmute"], button[aria-label*="মিউট"]');
        if (unmuteBtn) unmuteBtn.click();

        let skipBtn = document.querySelector('.ytp-ad-skip-button') || document.querySelector('.ytp-skip-ad-button');
        if (skipBtn) skipBtn.click();
        
        let adShowing = document.querySelector('.ad-showing');
        if (adShowing && videoElement) videoElement.playbackRate = 16.0;
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    let style = document.createElement('style');
    style.innerHTML = \`
        ytm-mobile-topbar-renderer, ytm-item-section-renderer, header, 
        ytm-single-column-watch-next-results-renderer, .ytp-chrome-top, .ytp-chrome-bottom,
        ytm-pivot-bar-renderer, .slim-video-action-bar-renderer, ytm-slim-owner-renderer,
        .ytm-bottom-sheet, .ytp-related-video-overlay, .ytp-watermark {
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }
        
        body, html { 
            overflow: hidden !important; 
            background: #000 !important; 
            margin: 0 !important; 
            padding: 0 !important; 
        }
    \`;
    document.head.appendChild(style);

    setInterval(() => {
        let btns = document.querySelectorAll('button');
        btns.forEach(b => { 
            if(b.innerText && (b.innerText.includes('Accept') || b.innerText.includes('Reject') || b.innerText.includes('Not now'))) {
                b.click(); 
            }
        });
    }, 1000);

    setInterval(() => {
        let vid = document.querySelector('video');
        if (vid) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'SYNC', paused: vid.paused, ready: vid.readyState > 0
            }));
        }
    }, 500);
    
    true;
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SYNC') {
        if (data.ready && loading) setLoading(false);
      }
    } catch (e) {}
  };

  // =========================================================
  // রিলেটেড ভিডিও আনা এবং অনবরত লোড করা (Infinite Scroll) + HD Thumbnail
  // =========================================================
  const fetchRelatedVideos = async (isLoadMore = false) => {
    if (isLoadMore) setIsLoadingMore(true);
    try {
      let query = videoData.channel || "trending bangla news";
      if (isLoadMore && videoData.title) {
         const words = videoData.title.split(' ');
         query = words.slice(0, Math.min(3, words.length)).join(' ') + " " + Math.floor(Math.random() * 100);
      }

      const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
      const htmlText = await response.text();
      const match = htmlText.match(/var ytInitialData = (.*?);<\/script>/);
      if (!match || !match[1]) return;
      
      const jsonData = JSON.parse(match[1]);
      const extractedVids = [];
      const extractNodes = (node) => {
        if (Array.isArray(node)) node.forEach(child => extractNodes(child));
        else if (node && typeof node === 'object') {
          if (node.videoRenderer && node.videoRenderer.videoId && node.videoRenderer.videoId !== videoId) extractedVids.push(node.videoRenderer);
          else Object.values(node).forEach(child => extractNodes(child));
        }
      };
      extractNodes(jsonData);
      
      const formatted = extractedVids.map(vid => {
        // HD Thumbnail জেনারেট করা হচ্ছে
        let hdThumbUrl = `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`;
        return {
          id: String(vid.videoId), 
          title: String(vid.title?.runs?.[0]?.text || 'অজ্ঞাত শিরোনাম'),
          channel: String(vid.ownerText?.runs?.[0]?.text || vid.longBylineText?.runs?.[0]?.text || 'YouTube Channel'),
          views: String(vid.viewCountText?.simpleText || 'N/A'), 
          time: String(vid.publishedTimeText?.simpleText || ''),
          duration: String(vid.lengthText?.simpleText || ''), 
          thumbnail: hdThumbUrl, // HD Thumbnail
          avatar: vid.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url
        };
      });

      if (isLoadMore) {
        setRelatedVideos(prev => {
          const newVids = formatted.filter(newVid => !prev.find(v => v.id === newVid.id));
          return [...prev, ...newVids];
        });
      } else {
        setRelatedVideos(formatted);
      }
    } catch (error) {
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchRelatedVideos(false);
  }, [videoId]);

  const handleLoadMore = () => {
    if (!isLoadingMore) {
      fetchRelatedVideos(true);
    }
  };

  const renderRelatedVideo = ({ item }) => (
    <View style={styles.videoCard}>
      <TouchableOpacity style={styles.thumbnailContainer} activeOpacity={0.8} onPress={() => navigation.push('Player', { videoId: item.id, videoData: item })}>
        <Image source={{ uri: item.thumbnail || 'https://via.placeholder.com/600x400.png?text=No+Image' }} style={styles.thumbnailImage} />
        {item.duration ? <Text style={styles.durationBadge}>{item.duration}</Text> : null}
      </TouchableOpacity>
      <View style={styles.videoInfoContainer}>
        <Image source={{ uri: item.avatar || 'https://via.placeholder.com/150' }} style={styles.channelAvatar} />
        <TouchableOpacity style={styles.videoTextContainer} activeOpacity={0.8} onPress={() => navigation.push('Player', { videoId: item.id, videoData: item })}>
          <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.videoMeta}>{item.channel} • {item.views} {item.time ? `• ${item.time}` : ''}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.detailsContainer}>
      <Text style={styles.mainTitle} numberOfLines={2}>{videoData?.title || "ভিডিওর শিরোনাম"}</Text>
      <Text style={styles.mainViews}>{videoData?.views || "N/A"} views • {videoData?.time || "Recently"}</Text>
      
      <View style={styles.channelRow}>
        <Image source={{ uri: videoData?.avatar || 'https://via.placeholder.com/150' }} style={styles.mainAvatar} />
        <View style={styles.channelTextCol}>
          <Text style={styles.mainChannelName}>{videoData?.channel || "YouTube Channel"}</Text>
        </View>
        <TouchableOpacity style={styles.subscribeBtn}>
          <Text style={styles.subscribeText}>Subscribe</Text>
        </TouchableOpacity>
      </View>

      {/* ৩টি অ্যাকশন বাটন */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleDownload}>
          <Ionicons name="download-outline" size={22} color="#FFF" />
          <Text style={styles.actionBtnText}>Download</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Ionicons name="arrow-redo-outline" size={22} color="#FFF" />
          <Text style={styles.actionBtnText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleBackgroundAudio}>
          <Ionicons name="headset-outline" size={22} color="#FFF" />
          <Text style={styles.actionBtnText}>Audio Play</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.divider} />

    </View>
  );

  const getPlayerStyle = () => {
    if (!isFullScreen) return [styles.playerWrapper, isShorts && { height: 450 }];
    if (isShorts) return styles.fullScreenPortrait;
    return styles.fullScreenLandscape; 
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullScreen} translucent={true} barStyle="light-content" backgroundColor="#000" />

      <TouchableWithoutFeedback onPress={resetControlsTimeout}>
        <View style={getPlayerStyle()}>
          
          <WebView
            ref={webViewRef}
            source={{ uri: videoUrl }}
            userAgent={currentConfig.userAgent}
            style={styles.webview}
            injectedJavaScript={injectScript}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            allowsBackgroundMediaPlayback={true} // ব্যাকগ্রাউন্ড অডিওর জন্য
            scalesPageToFit={false} 
            bounces={false}         
          />

          {showControls && (
            <View style={styles.controlsOverlay} pointerEvents="box-none">
              <View style={styles.topControls} pointerEvents="box-none">
                <TouchableOpacity onPress={() => isFullScreen ? setIsFullScreen(false) : navigation.goBack()} style={styles.cornerBtn}>
                  <Ionicons name="chevron-down" size={32} color="#FFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.bottomControls} pointerEvents="box-none">
                <View style={{flex: 1}} pointerEvents="none" /> 
                <TouchableOpacity onPress={() => setIsFullScreen(!isFullScreen)} style={styles.cornerBtn}>
                  <Ionicons name={isFullScreen ? "contract" : "expand"} size={26} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FF0000" />
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {!isFullScreen && (
        <FlatList 
          data={relatedVideos}
          keyExtractor={(item, index) => item.id + index.toString()}
          renderItem={renderRelatedVideo}
          ListHeaderComponent={renderHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isLoadingMore ? <ActivityIndicator size="large" color="#FF0000" style={{ margin: 20 }} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  playerWrapper: { width: '100%', height: 240, backgroundColor: '#000', position: 'relative', zIndex: 10 },
  fullScreenLandscape: { 
      position: 'absolute', top: (height - width) / 2, left: (width - height) / 2, 
      width: height, height: width, transform: [{ rotate: '90deg' }], zIndex: 99999, backgroundColor: '#000' 
  },
  fullScreenPortrait: { position: 'absolute', top: 0, left: 0, width: width, height: height, zIndex: 99999, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', zIndex: 15 },
  
  controlsOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, justifyContent: 'space-between' },
  topControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 5, paddingTop: 5 },
  bottomControls: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 10, paddingBottom: 10 },
  cornerBtn: { padding: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 25, margin: 5 },

  videoCard: { marginBottom: 20, marginTop: 10 },
  thumbnailContainer: { width: '100%', height: 220, position: 'relative', backgroundColor: '#111' },
  thumbnailImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  durationBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', color: '#FFF', fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: 'bold' },
  videoInfoContainer: { flexDirection: 'row', padding: 12, alignItems: 'flex-start' },
  channelAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#333' },
  videoTextContainer: { flex: 1, paddingRight: 10 },
  videoTitle: { color: '#FFF', fontSize: 15, fontWeight: '500', marginBottom: 4, lineHeight: 20 },
  videoMeta: { color: '#AAA', fontSize: 12 },
  detailsContainer: { padding: 15 },
  mainTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', lineHeight: 24, marginBottom: 5 },
  mainViews: { color: '#AAA', fontSize: 13, marginBottom: 15 },
  channelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  mainAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#333', marginRight: 12 },
  channelTextCol: { flex: 1 },
  mainChannelName: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  subscribeBtn: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  subscribeText: { color: '#000', fontWeight: 'bold', fontSize: 14 },

  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 10, paddingVertical: 10 },
  actionBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#222', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25, width: '30%' },
  actionBtnText: { color: '#FFF', fontSize: 12, marginTop: 4, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#333', marginTop: 15, width: '100%' }
});