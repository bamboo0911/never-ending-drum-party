// 延遲管理與時間同步模組
const LatencyManager = (function() {
    // 服務器與客戶端時間差
    let serverTimeOffset = 0;
    // 網絡延遲估計 (毫秒)
    let networkLatency = 0;
    // 時間同步樣本數
    const TIME_SYNC_SAMPLES = 5;
    // 保存同步樣本
    const latencySamples = [];
    // 是否已完成初始同步
    let isInitialSyncComplete = false;
    // 音頻播放提前量 (毫秒) - 根據測試調整
    const AUDIO_ADVANCE_TIME = 20;
  
    // 初始化延遲管理
    function init() {
      console.log('初始化延遲管理...');
      return startTimeSync();
    }
  
    // 開始時間同步過程
    function startTimeSync() {
      return new Promise((resolve) => {
        // 進行多次同步以獲得更準確的結果
        const syncPromises = [];
        
        for (let i = 0; i < TIME_SYNC_SAMPLES; i++) {
          syncPromises.push(new Promise(resolveSync => {
            setTimeout(() => {
              performTimeSync().then(resolveSync);
            }, i * 300); // 間隔300毫秒進行多次同步
          }));
        }
        
        Promise.all(syncPromises).then(() => {
          // 計算平均延遲和時間差
          calculateFinalLatency();
          isInitialSyncComplete = true;
          console.log(`時間同步完成: 網絡延遲=${networkLatency}ms, 時間偏移=${serverTimeOffset}ms`);
          resolve(true);
        });
      });
    }
  
    // 執行單次時間同步
    function performTimeSync() {
      return new Promise((resolve) => {
        const syncStartTime = Date.now();
        
        // 請求服務器時間
        window.SocketManager.requestServerTime()
          .then(serverTime => {
            const syncEndTime = Date.now();
            const roundTripTime = syncEndTime - syncStartTime;
            const estimatedOneWayLatency = Math.floor(roundTripTime / 2);
            
            // 計算本地時間與服務器時間的差異
            // 客戶端時間 + 偏移 = 服務器時間
            const clientTimeAtServerResponse = syncEndTime - estimatedOneWayLatency;
            const timeOffset = serverTime - clientTimeAtServerResponse;
            
            // 保存這次同步樣本
            latencySamples.push({
              latency: estimatedOneWayLatency,
              offset: timeOffset
            });
            
            resolve();
          })
          .catch(err => {
            console.error('時間同步失敗:', err);
            resolve();
          });
      });
    }
  
    // 計算最終的延遲和時間偏移
    function calculateFinalLatency() {
      if (latencySamples.length === 0) {
        return;
      }
      
      // 排序並取中間值以避免異常值的影響
      const sortedLatencies = [...latencySamples].sort((a, b) => a.latency - b.latency);
      const medianIndex = Math.floor(sortedLatencies.length / 2);
      
      networkLatency = sortedLatencies[medianIndex].latency;
      serverTimeOffset = sortedLatencies[medianIndex].offset;
    }
  
    // 獲取校正後的服務器時間
    function getServerTime() {
      return Date.now() + serverTimeOffset;
    }
  
    // 校正事件時間
    function adjustEventTime(localTimestamp) {
      return localTimestamp + serverTimeOffset;
    }
  
    // 決定音頻播放時間 (考慮網絡延遲和提前量)
    function calculateAudioPlayTime(eventTimestamp) {
      const currentServerTime = getServerTime();
      const playDelay = Math.max(0, eventTimestamp - currentServerTime);
      
      // 提前一點播放以補償音頻系統的內部延遲
      return Math.max(0, playDelay - AUDIO_ADVANCE_TIME);
    }
  
    // 檢查是否需要立即播放或延遲播放
    function shouldPlayImmediately(eventTimestamp) {
      const playTime = calculateAudioPlayTime(eventTimestamp);
      return playTime <= 0;
    }
  
    // 安排延遲播放
    function scheduleDelayedPlay(eventTimestamp, callback) {
      const delayTime = calculateAudioPlayTime(eventTimestamp);
      
      if (delayTime <= 0) {
        // 立即播放
        callback();
        return 0;
      } else {
        // 延遲播放
        setTimeout(callback, delayTime);
        return delayTime;
      }
    }
  
    // 暴露公共方法
    return {
      init,
      getServerTime,
      adjustEventTime,
      calculateAudioPlayTime,
      shouldPlayImmediately,
      scheduleDelayedPlay,
      get networkLatency() { return networkLatency; },
      get isReady() { return isInitialSyncComplete; }
    };
  })();
  
  // 導出模組
  window.LatencyManager = LatencyManager;