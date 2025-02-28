// Enhanced Latency Management & Time Synchronization Module
const LatencyManager = (function() {
    // Server-client time offset (ms)
    let serverTimeOffset = 0;
    // Network latency estimation (ms)
    let networkLatency = 0;
    // Time sync samples
    const TIME_SYNC_SAMPLES = 5;
    // Store sync samples
    const latencySamples = [];
    // Initial sync status
    let isInitialSyncComplete = false;
    // Audio playback advance time (ms) - adjusted based on testing
    const AUDIO_ADVANCE_TIME = 20;
    // Last sync time
    let lastSyncTime = 0;
    // Sync interval (every 5 minutes)
    const SYNC_INTERVAL = 5 * 60 * 1000;
    // Maximum number of sync retries
    const MAX_SYNC_RETRIES = 3;
    // Current retry count
    let syncRetryCount = 0;
    // Default jitter buffer (ms)
    let jitterBuffer = 15;
  
    /**
     * Initialize latency management
     * @returns {Promise} Resolution indicates completion
     */
    function init() {
      console.log('初始化延遲管理...');
      lastSyncTime = Date.now();
      return startTimeSync();
    }
  
    /**
     * Start time synchronization process
     * @returns {Promise} Resolution indicates completion
     */
    function startTimeSync() {
      return new Promise((resolve, reject) => {
        syncRetryCount = 0;
        const syncPromises = [];
        
        // Multiple sync attempts for accuracy
        for (let i = 0; i < TIME_SYNC_SAMPLES; i++) {
          syncPromises.push(new Promise(resolveSync => {
            setTimeout(() => {
              performTimeSync()
                .then(resolveSync)
                .catch(error => {
                  console.warn('Time sync attempt failed:', error);
                  resolveSync({ failed: true });
                });
            }, i * 300); // 300ms interval between attempts
          }));
        }
        
        Promise.all(syncPromises)
          .then(results => {
            // Filter out failed attempts
            const successfulAttempts = results.filter(r => !r || !r.failed);
            
            if (successfulAttempts.length < 3) {
              // Not enough successful samples, retry if under max retries
              if (syncRetryCount < MAX_SYNC_RETRIES) {
                syncRetryCount++;
                console.log(`重試時間同步 (${syncRetryCount}/${MAX_SYNC_RETRIES})...`);
                return startTimeSync().then(resolve).catch(reject);
              } else {
                console.warn('無法完成時間同步，使用預設值');
                // Use reasonable defaults if sync fails
                networkLatency = 100;
                serverTimeOffset = 0;
                isInitialSyncComplete = true;
                resolve(false);
              }
            } else {
              // Calculate final latency values
              calculateFinalLatency();
              isInitialSyncComplete = true;
              console.log(`時間同步完成: 網絡延遲=${networkLatency}ms, 時間偏移=${serverTimeOffset}ms`);
              
              // Adjust jitter buffer based on network conditions
              adjustJitterBuffer();
              
              // Schedule periodic sync
              schedulePeriodicSync();
              
              resolve(true);
            }
          })
          .catch(error => {
            console.error('Time sync failed:', error);
            reject(error);
          });
      });
    }
  
    /**
     * Perform a single time synchronization
     * @returns {Promise} Resolution indicates completion
     */
    function performTimeSync() {
      return new Promise((resolve, reject) => {
        const syncStartTime = Date.now();
        const requestId = `sync-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Create a timeout in case server doesn't respond
        const timeoutId = setTimeout(() => {
          reject(new Error('Time sync request timed out'));
        }, 3000);
        
        // Request server time with unique ID
        window.SocketManager.requestServerTime(requestId)
          .then(serverResponse => {
            clearTimeout(timeoutId);
            
            const syncEndTime = Date.now();
            const roundTripTime = syncEndTime - syncStartTime;
            const estimatedOneWayLatency = Math.floor(roundTripTime / 2);
            
            // Calculate local time at server response using estimated latency
            const clientTimeAtServerResponse = syncEndTime - estimatedOneWayLatency;
            const timeOffset = serverResponse.serverTime - clientTimeAtServerResponse;
            
            // Store this sync sample
            latencySamples.push({
              latency: estimatedOneWayLatency,
              offset: timeOffset,
              roundTrip: roundTripTime
            });
            
            resolve();
          })
          .catch(err => {
            clearTimeout(timeoutId);
            console.error('時間同步失敗:', err);
            reject(err);
          });
      });
    }
  
    /**
     * Calculate final latency and offset values
     */
    function calculateFinalLatency() {
      if (latencySamples.length === 0) {
        return;
      }
      
      // Sort by latency to find median
      const sortedLatencies = [...latencySamples].sort((a, b) => a.latency - b.latency);
      const medianIndex = Math.floor(sortedLatencies.length / 2);
      
      // Use median values to avoid outliers
      networkLatency = sortedLatencies[medianIndex].latency;
      serverTimeOffset = sortedLatencies[medianIndex].offset;
      
      // Calculate jitter (variation in latency)
      const latencyValues = latencySamples.map(s => s.latency);
      const avgLatency = latencyValues.reduce((sum, val) => sum + val, 0) / latencyValues.length;
      const jitter = Math.sqrt(
        latencyValues.map(l => Math.pow(l - avgLatency, 2))
          .reduce((sum, val) => sum + val, 0) / latencyValues.length
      );
      
      console.log(`網絡抖動: ${jitter.toFixed(2)}ms`);
    }
  
    /**
     * Adjust jitter buffer based on network conditions
     */
    function adjustJitterBuffer() {
      // Calculate jitter
      const latencyValues = latencySamples.map(s => s.latency);
      const avgLatency = latencyValues.reduce((sum, val) => sum + val, 0) / latencyValues.length;
      
      // Standard deviation calculation
      const jitter = Math.sqrt(
        latencyValues.map(l => Math.pow(l - avgLatency, 2))
          .reduce((sum, val) => sum + val, 0) / latencyValues.length
      );
      
      // Adjust jitter buffer (minimum 15ms, maximum 100ms)
      jitterBuffer = Math.min(100, Math.max(15, jitter * 2));
      console.log(`調整抖動緩衝區: ${jitterBuffer.toFixed(2)}ms`);
    }
  
    /**
     * Schedule periodic time synchronization
     */
    function schedulePeriodicSync() {
      setInterval(() => {
        // Only sync if enough time has passed since last sync
        const now = Date.now();
        if (now - lastSyncTime >= SYNC_INTERVAL) {
          console.log('執行定期時間同步...');
          lastSyncTime = now;
          
          // Clear old samples and resync
          latencySamples.length = 0;
          startTimeSync().catch(error => {
            console.error('定期時間同步失敗:', error);
          });
        }
      }, 60000); // Check every minute
    }
  
    /**
     * Get corrected server time
     * @returns {number} Corrected server time
     */
    function getServerTime() {
      return Date.now() + serverTimeOffset;
    }
  
    /**
     * Adjust event time
     * @param {number} localTimestamp - Local timestamp
     * @returns {number} Adjusted timestamp
     */
    function adjustEventTime(localTimestamp) {
      return localTimestamp + serverTimeOffset;
    }
  
    /**
     * Calculate audio playback time
     * @param {number} eventTimestamp - Event timestamp
     * @returns {number} Playback delay in ms
     */
    function calculateAudioPlayTime(eventTimestamp) {
      const currentServerTime = getServerTime();
      let playDelay = Math.max(0, eventTimestamp - currentServerTime);
      
      // Apply jitter buffer if network conditions are unstable
      if (networkLatency > 80 || jitterBuffer > 30) {
        playDelay += jitterBuffer;
      }
      
      // Compensate for audio system latency
      return Math.max(0, playDelay - AUDIO_ADVANCE_TIME);
    }
  
    /**
     * Check if playback should happen immediately
     * @param {number} eventTimestamp - Event timestamp
     * @returns {boolean} True if should play immediately
     */
    function shouldPlayImmediately(eventTimestamp) {
      const playTime = calculateAudioPlayTime(eventTimestamp);
      return playTime <= 0;
    }
  
    /**
     * Schedule delayed playback
     * @param {number} eventTimestamp - Event timestamp
     * @param {Function} callback - Callback function
     * @returns {number} Delay time in ms
     */
    function scheduleDelayedPlay(eventTimestamp, callback) {
      const delayTime = calculateAudioPlayTime(eventTimestamp);
      
      if (delayTime <= 0) {
        // Play immediately
        callback();
        return 0;
      } else {
        // Schedule delayed play
        setTimeout(callback, delayTime);
        return delayTime;
      }
    }
  
    /**
     * Get network statistics
     * @returns {Object} Network stats
     */
    function getNetworkStats() {
      if (!isInitialSyncComplete) {
        return { status: 'initializing' };
      }
      
      let quality = 'unknown';
      
      if (networkLatency < 50) {
        quality = 'excellent';
      } else if (networkLatency < 100) {
        quality = 'good';
      } else if (networkLatency < 200) {
        quality = 'fair';
      } else {
        quality = 'poor';
      }
      
      return {
        status: 'ready',
        latency: networkLatency,
        jitterBuffer,
        quality,
        offset: serverTimeOffset
      };
    }
  
    // Public API
    return {
      init,
      getServerTime,
      adjustEventTime,
      calculateAudioPlayTime,
      shouldPlayImmediately,
      scheduleDelayedPlay,
      getNetworkStats,
      get networkLatency() { return networkLatency; },
      get jitterBuffer() { return jitterBuffer; },
      get isReady() { return isInitialSyncComplete; }
    };
  })();
  
  // Export module
  window.LatencyManager = LatencyManager;