// 零延遲音頻引擎
const AudioManager = (function() {
    // 音頻上下文
    let audioContext;
    // 預先連接好的音頻源庫
    const preparedSources = {};
    // 音頻緩衝區
    const audioBuffers = {};
    // 聲音類型
    const soundTypes = ['kick', 'snare', 'hihat', 'tom', 'crash'];
    // 音頻已解鎖
    let isAudioUnlocked = false;
    // 每種聲音的預備數量
    const SOURCES_PER_TYPE = 3;
    // 最小音頻長度
    const MIN_DURATION = 0.05; // 50毫秒
  
    /**
     * 初始化音頻上下文
     * @returns {Promise} 完成時解析
     */
    function init() {
      return new Promise((resolve) => {
        try {
          // 創建音頻上下文（使用最低延遲配置）
          window.AudioContext = window.AudioContext || window.webkitAudioContext;
          audioContext = new AudioContext({
            latencyHint: 'interactive', // 最低延遲模式
            sampleRate: 44100
          });
          console.log('音頻上下文已初始化', audioContext.state);
          
          // 設置音頻解鎖（所有設備，尤其是iOS）
          setupAudioUnlock();
          
          // 快速創建所有音頻樣本
          createAllSoundSamples()
            .then(() => {
              // 預備所有音頻源
              prepareAllAudioSources();
              console.log('所有音頻源已預備就緒');
              resolve(true);
            })
            .catch(error => {
              console.error('音頻初始化失敗:', error);
              resolve(false);
            });
        } catch (error) {
          console.error('無法創建音頻上下文:', error);
          resolve(false);
        }
      });
    }
  
    /**
     * 設置音頻解鎖
     */
    function setupAudioUnlock() {
      const unlockAudio = function() {
        if (isAudioUnlocked) return;
        
        // 嘗試恢復音頻上下文（如果處於暫停狀態）
        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(error => {
            console.warn('音頻上下文恢復失敗:', error);
          });
        }
        
        // 創建並立即播放一個空白緩衝區
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        isAudioUnlocked = true;
        console.log('音頻已解鎖');
        
        // 移除所有事件監聽器
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('touchend', unlockAudio);
        document.removeEventListener('click', unlockAudio);
        
        // 解鎖後立即準備所有音頻
        if (Object.keys(audioBuffers).length > 0) {
          prepareAllAudioSources();
        } else {
          createAllSoundSamples().then(prepareAllAudioSources);
        }
      };
      
      document.addEventListener('touchstart', unlockAudio, false);
      document.addEventListener('touchend', unlockAudio, false);
      document.addEventListener('click', unlockAudio, false);
      
      // 自動嘗試解鎖
      unlockAudio();
    }
  
    /**
     * 快速創建所有聲音樣本
     * @returns {Promise} 完成時解析
     */
    function createAllSoundSamples() {
      const promises = soundTypes.map(type => createMinimalSoundSample(type));
      return Promise.all(promises);
    }
  
    /**
     * 為每種聲音類型創建最小化聲音樣本
     * @param {string} type - 聲音類型
     * @returns {Promise} 包含AudioBuffer的Promise
     */
    function createMinimalSoundSample(type) {
      return new Promise(resolve => {
        // 最小化音頻配置
        const configs = {
          'kick': { freq: 60, duration: 0.08, attack: 0.001, decay: 0.08 },
          'snare': { freq: 200, duration: 0.06, attack: 0.001, decay: 0.05, noise: true },
          'hihat': { freq: 800, duration: 0.04, attack: 0.001, decay: 0.03, noise: true },
          'tom': { freq: 150, duration: 0.08, attack: 0.001, decay: 0.08 },
          'crash': { freq: 1200, duration: 0.1, attack: 0.001, decay: 0.1, noise: true }
        };
        
        const config = configs[type] || configs.kick;
        
        // 創建非常短的音頻樣本
        const duration = Math.max(MIN_DURATION, config.duration);
        const sampleRate = audioContext.sampleRate;
        const frameCount = Math.ceil(sampleRate * duration);
        const audioBuffer = audioContext.createBuffer(1, frameCount, sampleRate);
        const data = audioBuffer.getChannelData(0);
        
        // 根據配置生成音頻數據
        generateAudioData(data, config, sampleRate);
        
        // 存儲並解析
        audioBuffers[type] = audioBuffer;
        console.log(`創建極簡音頻: ${type}`);
        resolve(audioBuffer);
      });
    }
  
    /**
     * 生成優化的音頻數據
     * @param {Float32Array} data - 音頻數據數組
     * @param {Object} config - 音頻配置
     * @param {number} sampleRate - 採樣率
     */
    function generateAudioData(data, config, sampleRate) {
      const { freq, attack, decay, noise } = config;
      const frameCount = data.length;
      
      for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate;
        // 快速攻擊衰減包絡
        let envelope;
        if (t < attack) {
          envelope = t / attack; // 快速攻擊
        } else {
          envelope = Math.exp(-(t - attack) / (decay || 0.05)); // 指數衰減
        }
        
        // 基本波形
        let sample = Math.sin(2 * Math.PI * freq * t);
        
        // 添加噪聲（如果需要）
        if (noise) {
          const noiseAmount = Math.random() * 2 - 1;
          sample = sample * 0.5 + noiseAmount * 0.5;
        }
        
        // 應用包絡
        data[i] = sample * envelope;
      }
    }
  
    /**
     * 預備所有音頻源
     */
    function prepareAllAudioSources() {
      soundTypes.forEach(type => {
        if (!audioBuffers[type]) return;
        
        // 為每種類型準備多個源
        preparedSources[type] = [];
        for (let i = 0; i < SOURCES_PER_TYPE; i++) {
          prepareAudioSource(type);
        }
      });
    }
  
    /**
     * 準備單個音頻源
     * @param {string} type - 聲音類型
     */
    function prepareAudioSource(type) {
      if (!audioBuffers[type]) return null;
      
      // 創建緩衝區源
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffers[type];
      
      // 創建增益節點
      const gain = audioContext.createGain();
      gain.gain.value = 0; // 初始靜音
      
      // 連接節點
      source.connect(gain);
      gain.connect(audioContext.destination);
      
      // 創建源對象
      const sourceObj = {
        source,
        gain,
        prepared: true,
        used: false
      };
      
      // 添加到預備源列表
      if (!preparedSources[type]) {
        preparedSources[type] = [];
      }
      preparedSources[type].push(sourceObj);
      
      return sourceObj;
    }
  
    /**
     * 以零延遲播放聲音
     * @param {string} type - 聲音類型
     * @returns {boolean} 成功狀態
     */
    function playSound(type) {
      // 確保音頻上下文正在運行
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(console.error);
      }
      
      // 檢查預備源
      if (!preparedSources[type] || preparedSources[type].length === 0) {
        // 如果沒有預備源，嘗試即時創建
        if (audioBuffers[type]) {
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffers[type];
          source.connect(audioContext.destination);
          source.start(0);
          
          // 非同步準備新源
          setTimeout(() => prepareAudioSource(type), 0);
          return true;
        }
        return false;
      }
      
      // 使用預備源
      let sourceObj = preparedSources[type].find(s => s.prepared && !s.used);
      
      // 如果沒有可用的預備源，重用最後一個
      if (!sourceObj) {
        sourceObj = preparedSources[type][0];
      }
      
      // 標記為已使用
      sourceObj.used = true;
      
      // 將增益快速提高到正常水平
      sourceObj.gain.gain.cancelScheduledValues(audioContext.currentTime);
      sourceObj.gain.gain.setValueAtTime(1, audioContext.currentTime);
      
      // 開始播放
      try {
        sourceObj.source.start(0);
        
        // 立即準備新源以供下次使用
        setTimeout(() => {
          // 從列表中移除已用源
          const index = preparedSources[type].indexOf(sourceObj);
          if (index > -1) {
            preparedSources[type].splice(index, 1);
          }
          
          // 創建新源
          prepareAudioSource(type);
        }, 0);
        
        return true;
      } catch (error) {
        console.warn('播放音頻失敗:', error);
        // 嘗試即時創建新源
        try {
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffers[type];
          source.connect(audioContext.destination);
          source.start(0);
          return true;
        } catch (e) {
          console.error('備用播放也失敗:', e);
          return false;
        }
      }
    }
  
    // 公共API
    return {
      init,
      playSound
    };
  })();
  
  // 導出模組
  window.AudioManager = AudioManager;