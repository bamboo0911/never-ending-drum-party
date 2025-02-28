// 音頻管理模組
const AudioManager = (function() {
    // 音頻上下文
    let audioContext;
    // 音頻緩衝區
    const audioBuffers = {};
    // 預設音頻列表
    const sounds = [
      { name: 'kick', url: '/sounds/kick.mp3' },
      { name: 'snare', url: '/sounds/snare.mp3' },
      { name: 'hihat', url: '/sounds/hihat.mp3' },
      { name: 'tom', url: '/sounds/tom.mp3' },
      { name: 'crash', url: '/sounds/crash.mp3' }
    ];
  
    // 初始化音頻上下文
    function init() {
      try {
        // 創建音頻上下文（兼容性處理）
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        console.log('音頻上下文已初始化');
        
        // 自動加載音頻文件
        return loadAllSounds();
      } catch (error) {
        console.error('無法初始化音頻上下文:', error);
        return Promise.reject(error);
      }
    }
  
    // 加載所有聲音
    async function loadAllSounds() {
      try {
        // 檢查是否有正式音頻文件，如果沒有則使用臨時音頻
        const promises = sounds.map(sound => loadSound(sound.name, sound.url)
          .catch(() => {
            console.warn(`無法載入 ${sound.url}，使用臨時音頻`);
            return createTempSound(sound.name);
          })
        );
        
        await Promise.all(promises);
        console.log('所有音頻已成功加載');
        return true;
      } catch (error) {
        console.error('加載音頻失敗:', error);
        return false;
      }
    }
  
    // 加載單個音頻文件
    async function loadSound(name, url) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBuffers[name] = audioBuffer;
        console.log(`已載入音頻: ${name}`);
        return audioBuffer;
      } catch (error) {
        console.error(`無法載入音頻 ${name}:`, error);
        throw error;
      }
    }
  
    // 播放音效
    function playSound(name) {
      if (!audioContext) {
        console.error('音頻上下文尚未初始化');
        return;
      }
      
      // 如果音頻上下文被暫停（瀏覽器策略），則恢復
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      if (audioBuffers[name]) {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffers[name];
        source.connect(audioContext.destination);
        source.start(0);
        return true;
      } else {
        console.warn(`未找到音頻: ${name}`);
        return false;
      }
    }
  
    // 創建臨時音頻（當實際音頻無法載入時使用）
    function createTempSound(name) {
      return new Promise((resolve) => {
        let oscillator;
        let gain;
        let duration = 0.2;
        
        // 為不同類型的鼓配置不同參數
        switch (name) {
          case 'kick':
            createTempBuffer(60, 0.8, 'sine', 0.1, 0.2);
            break;
          case 'snare':
            createTempBuffer(200, 0.5, 'square', 0.01, 0.15);
            break;
          case 'hihat':
            createTempBuffer(800, 0.3, 'highpass', 0, 0.08);
            break;
          case 'tom':
            createTempBuffer(150, 0.5, 'sine', 0.05, 0.2);
            break;
          case 'crash':
            createTempBuffer(1200, 0.3, 'highpass', 0, 0.4);
            break;
          default:
            createTempBuffer(440, 0.5, 'sine', 0, 0.2);
        }
        
        // 創建臨時的音頻緩衝區
        function createTempBuffer(frequency, volume, type, decay, soundDuration) {
          duration = soundDuration || 0.2;
          
          // 創建一個空的音頻緩衝區
          const sampleRate = audioContext.sampleRate;
          const bufferSize = sampleRate * duration;
          const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
          const data = buffer.getChannelData(0);
          
          // 生成音頻數據
          for (let i = 0; i < bufferSize; i++) {
            // 衰減處理
            const t = i / sampleRate;
            const amplitude = Math.max(0, volume * (1 - t / duration));
            
            // 不同的波形
            if (type === 'sine') {
              data[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
            } else if (type === 'square') {
              data[i] = amplitude * (Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1) * Math.random();
            } else if (type === 'highpass') {
              data[i] = amplitude * Math.sin(2 * Math.PI * frequency * t * Math.random());
            }
          }
          
          // 存入緩衝區
          audioBuffers[name] = buffer;
          console.log(`已創建臨時音頻: ${name}`);
          resolve(buffer);
        }
      });
    }
  
    // 暴露公共方法
    return {
      init,
      playSound,
      loadAllSounds
    };
  })();
  
  // 導出模組
  window.AudioManager = AudioManager;