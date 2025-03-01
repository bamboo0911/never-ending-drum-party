// 零延遲音頻引擎 - 增強版合成音色
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
     * 為每種聲音類型創建更豐富的聲音樣本
     * @param {string} type - 聲音類型
     * @returns {Promise} 包含AudioBuffer的Promise
     */
    function createMinimalSoundSample(type) {
      return new Promise(resolve => {
        // 更豐富的音頻配置
        const configs = {
          'kick': { 
            freqs: [60, 50, 45], // 多頻率增加層次感
            duration: 0.18, 
            attack: 0.001, 
            decay: 0.16, 
            resonance: 0.9, // 共鳴效果
            bassPunch: true // 低頻增強
          },
          'snare': { 
            freqs: [200, 180, 500], // 多頻率
            duration: 0.14, 
            attack: 0.001, 
            decay: 0.12, 
            noise: true,
            noiseMix: 0.7, // 控制噪聲混合比例
            snapEnhance: true // 增強啪聲
          },
          'hihat': { 
            freqs: [8000, 10000, 12000], 
            duration: 0.09, 
            attack: 0.001, 
            decay: 0.07, 
            noise: true,
            noiseMix: 0.9,
            filter: {type: 'highpass', freq: 7000},
            metallic: true // 金屬感
          },
          'tom': { 
            freqs: [150, 130, 100], 
            duration: 0.2, 
            attack: 0.001, 
            decay: 0.18,
            resonance: 0.8,
            pitchBend: true // 音高彎曲
          },
          'crash': { 
            freqs: [1200, 1000, 3000, 6000], 
            duration: 0.25, 
            attack: 0.001, 
            decay: 0.22, 
            noise: true,
            noiseMix: 0.6,
            metallic: true,
            shimmer: true // 閃爍效果
          }
        };
        
        const config = configs[type] || configs.kick;
        
        // 創建更長的音頻樣本
        const duration = Math.max(MIN_DURATION, config.duration);
        const sampleRate = audioContext.sampleRate;
        const frameCount = Math.ceil(sampleRate * duration);
        const audioBuffer = audioContext.createBuffer(1, frameCount, sampleRate);
        const data = audioBuffer.getChannelData(0);
        
        // 使用增強的音頻數據生成
        generateEnhancedAudioData(data, config, sampleRate);
        
        // 存儲並解析
        audioBuffers[type] = audioBuffer;
        console.log(`創建豐富音頻: ${type}`);
        resolve(audioBuffer);
      });
    }
  
    /**
     * 生成更豐富的音頻數據
     * @param {Float32Array} data - 音頻數據數組
     * @param {Object} config - 音頻配置
     * @param {number} sampleRate - 採樣率
     */
    function generateEnhancedAudioData(data, config, sampleRate) {
      const { freqs, attack, decay, noise, noiseMix, resonance, bassPunch, snapEnhance, metallic, pitchBend, shimmer } = config;
      const frameCount = data.length;
      
      // 主要音頻數據生成
      for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate;
        
        // 進階包絡線計算
        let envelope;
        if (t < attack) {
          envelope = Math.pow(t / attack, 2); // 非線性攻擊
        } else {
          // 帶共鳴的衰減
          const decayTime = t - attack;
          envelope = Math.exp(-decayTime / (decay || 0.05));
          
          // 添加共鳴效果
          if (resonance && decayTime < decay * 0.5) {
            envelope *= 1 + (resonance * Math.sin(Math.PI * decayTime / (decay * 0.25)) * 0.5);
          }
        }
        
        // 初始化樣本
        let sample = 0;
        
        // 多頻率合成
        if (freqs && freqs.length) {
          for (let f = 0; f < freqs.length; f++) {
            let freq = freqs[f];
            
            // 音高彎曲效果
            if (pitchBend) {
              const bendAmount = Math.min(0.9, 1.0 - t / config.duration);
              freq *= (1.0 + bendAmount * 0.5);
            }
            
            // 添加每個頻率成分
            const amplitude = 1.0 - (f / freqs.length * 0.5); // 更高頻率的振幅較小
            sample += Math.sin(2 * Math.PI * freq * t) * amplitude;
          }
          
          // 正規化
          sample /= freqs.length;
        }
        
        // 添加噪聲
        if (noise) {
          const noiseAmount = (Math.random() * 2 - 1);
          const noiseMixValue = noiseMix || 0.5;
          sample = sample * (1 - noiseMixValue) + noiseAmount * noiseMixValue;
        }
        
        // 增強特性
        if (bassPunch && t < attack + 0.02) {
          // 低頻增強
          sample *= 1 + Math.sin(2 * Math.PI * 40 * t) * 0.5;
        }
        
        if (snapEnhance && t < 0.02) {
          // 啪聲增強
          sample += (Math.random() * 2 - 1) * (1 - t / 0.02) * 0.5;
        }
        
        if (metallic) {
          // 金屬感
          const metallicFreq = t < 0.01 ? 12000 : 8000;
          sample += Math.sin(2 * Math.PI * metallicFreq * t) * 0.1 * envelope;
        }
        
        if (shimmer && t > 0.01) {
          // 閃爍效果
          const shimmerEnv = Math.exp(-t / 0.1);
          sample += Math.sin(2 * Math.PI * (4000 + 2000 * Math.sin(2 * Math.PI * 10 * t)) * t) * 0.1 * shimmerEnv;
        }
        
        // 應用包絡並在最終寫入前限制範圍
        data[i] = Math.max(-0.98, Math.min(0.98, sample * envelope));
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