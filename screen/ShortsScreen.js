import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

// ইউজার এজেন্টগুলো
const STABLE_USER_AGENT = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";
const JIO_PHONE_AGENT = "Mozilla/5.0 (Mobile; LYF/F220B/LYF-F220B-000-01-28-290819; Android; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5";

export default function ShortsScreen({ initialVideoId, route }) {
  const [isAutoSkipping, setIsAutoSkipping] = useState(false);
  const [shortsLoading, setShortsLoading] = useState(true);
  const [showUnmuteBtn, setShowUnmuteBtn] = useState(false);
  const [showPlayBtn, setShowPlayBtn] = useState(false);
  
  const shortsWebViewRef = useRef(null);

  const videoId = initialVideoId || route?.params?.videoId;
  const targetUri = videoId ? `https://m.youtube.com/shorts/${videoId}` : "https://m.youtube.com/shorts";

  // =========================================================
  // কোয়ালিটি এবং মোড চেক
  // =========================================================
  const activeQuality = global.shortVideoQuality || 'Normal Video Quality';
  const isAntiDataSaver = activeQuality === 'Anti Data Saver Mode';

  const getShortsConfig = () => {
      if (isAntiDataSaver) {
          return { userAgent: JIO_PHONE_AGENT, qualityMode: "tiny" };
      } else if (activeQuality === 'Low Video Quality') {
          return { userAgent: STABLE_USER_AGENT, qualityMode: "small" };
      } else if (activeQuality === 'High Video Quality') {
          return { userAgent: STABLE_USER_AGENT, qualityMode: "hd1080" };
      } else {
          return { userAgent: STABLE_USER_AGENT, qualityMode: "medium" };
      }
  };

  const currentConfig = getShortsConfig();

  useEffect(() => {
    setShortsLoading(true);
    setShowUnmuteBtn(false);
    setShowPlayBtn(false);
    const timerLoading = setTimeout(() => setShortsLoading(false), 2000);
    const timerBtn = setTimeout(() => { setShowUnmuteBtn(true); setShowPlayBtn(true); }, 2500); 
    return () => { clearTimeout(timerLoading); clearTimeout(timerBtn); };
  }, [targetUri, activeQuality]);

  // =========================================================
  // আপনার দেওয়া অরিজিনাল মাস্টারমাইন্ড অ্যাড-ব্লকার (১০০% শক্তিতে)
  // =========================================================
  const shortsInjectScript = `
    (function() {
        try {
            window.localStorage.setItem('yt-player-quality', JSON.stringify({
                "data": "${currentConfig.qualityMode}", "expiration": Date.now() + 86400000, "creation": Date.now()
            }));
        } catch(e) {}

        const style = document.createElement('style');
        style.innerHTML = \`
            ytm-mobile-topbar-renderer, ytm-pivot-bar-renderer, header, .ytm-bottom-sheet { display: none !important; }
            ytm-ad-slot-renderer, ytm-promoted-sparkles-web-renderer, .ad-showing, .ad-interrupting, [is-ad] { display: none !important; }
        \`;
        document.head.appendChild(style);

        setInterval(() => {
            const reels = document.querySelectorAll('ytm-reel-video-renderer');
            for (let i = 0; i < reels.length; i++) {
                const reel = reels[i];
                const htmlContent = reel.innerHTML.toLowerCase();
                const textContent = reel.innerText || reel.textContent || "";
                
                const hasAdBadge = reel.querySelector('ytm-ad-slot-renderer, ytm-promoted-sparkles-web-renderer, [is-ad]') !== null;
                const hasAdKeyword = /sponsored|প্রযোজিত|ad|promoted/i.test(textContent.toLowerCase()) || htmlContent.includes('sponsored') || htmlContent.includes('প্রযোজিত');
                const isMissingHandle = textContent.length > 20 && !textContent.includes('@');

                if (hasAdBadge || hasAdKeyword || isMissingHandle) {
                    const rect = reel.getBoundingClientRect();
                    if (rect.top >= window.innerHeight || rect.bottom <= 0) {
                        reel.remove();
                    } else if (rect.top > -200 && rect.top < window.innerHeight) {
                        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage("SKIP_START");
                        const vid = reel.querySelector('video');
                        if (vid) { vid.src = ''; vid.remove(); }
                        reel.style.opacity = '0';
                        reel.innerHTML = '<div style="width:100%; height:100%; background:black;"></div>';
                        const nextReel = reels[i + 1];
                        if (nextReel) nextReel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        else window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });

                        setTimeout(() => {
                            reel.remove();
                            if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage("SKIP_END");
                        }, 500);
                    }
                }
            }
            const skipBtn = document.querySelector('.ytp-ad-skip-button') || document.querySelector('.ytp-skip-ad-button');
            if (skipBtn) skipBtn.click();
        }, 100);
    })();
    true;
  `;

  // =========================================================
  // ঘোস্ট টাচ লজিক
  // =========================================================
  const handleUnmutePress = () => {
    setShowUnmuteBtn(false); 
    if (shortsWebViewRef.current) {
      shortsWebViewRef.current.injectJavaScript(`
        let vids = document.querySelectorAll('video');
        vids.forEach(v => { if (v) { v.muted = false; v.volume = 1.0; } });
        let nativeUnmute = document.querySelector('.ytm-unmute') || document.querySelector('.ytp-unmute-inner');
        if(nativeUnmute) nativeUnmute.click(); true;
      `);
    }
  };

  const handlePlayPress = () => {
    setShowPlayBtn(false); 
    if (shortsWebViewRef.current) {
      shortsWebViewRef.current.injectJavaScript(`
        (function() {
            let centerX = window.innerWidth / 2; let centerY = window.innerHeight / 2;
            let el = document.elementFromPoint(centerX, centerY);
            if (el) el.click();
            else { let vids = document.querySelectorAll('video'); vids.forEach(v => { if (v && v.paused) v.play(); }); }
        })(); true;
      `);
    }
  };

  const onShortsMessage = (event) => {
    const data = event.nativeEvent.data;
    if (data === "SKIP_START") setIsAutoSkipping(true);
    if (data === "SKIP_END") setIsAutoSkipping(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000', position: 'relative' }}>
      <WebView 
        key={`${targetUri}-${currentConfig.qualityMode}`} 
        ref={shortsWebViewRef} 
        source={{ uri: targetUri }} 
        userAgent={currentConfig.userAgent} 
        injectedJavaScriptBeforeContentLoaded={shortsInjectScript}
        injectedJavaScript={shortsInjectScript}
        onMessage={onShortsMessage}
        onLoadEnd={() => setShortsLoading(false)} 
        javaScriptEnabled={true} 
        domStorageEnabled={true} 
        sharedCookiesEnabled={true}
        hardwareAccelerationEnabled={true}
        mediaPlaybackRequiresUserAction={false} 
      />
      
      {showUnmuteBtn && !shortsLoading && (
        <TouchableOpacity activeOpacity={0.8} style={styles.customUnmuteBtn} onPress={handleUnmutePress}>
          <Ionicons name="volume-high" size={12} color="#FFF" style={{marginRight: 6}} />
          <Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 10}}>TAP TO UNMUTE</Text>
        </TouchableOpacity>
      )}
      {showPlayBtn && !shortsLoading && (
        <TouchableOpacity activeOpacity={0.8} style={styles.customPlayBtn} onPress={handlePlayPress}>
          <Ionicons name="play" size={14} color="#FFF" style={{marginRight: 4}} />
          <Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 11}}>PLAY NOW</Text>
        </TouchableOpacity>
      )}

      {isAutoSkipping && ( 
        <View style={styles.skipOverlay}>
          <ActivityIndicator size="large" color="#FF0000" />
          <Text style={styles.skipText}>অ্যাড ফিল্টার হচ্ছে...</Text>
        </View> 
      )}
      
      {shortsLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="red" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  skipOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  skipText: { color: '#FFF', marginTop: 15, fontWeight: 'bold' },
  customUnmuteBtn: { position: 'absolute', top: 60, right: 20, backgroundColor: '#32CD32', flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 13, zIndex: 9999 },
  customPlayBtn: { position: 'absolute', top: '45%', alignSelf: 'center', backgroundColor: '#32CD32', flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 18, zIndex: 9999 },
});