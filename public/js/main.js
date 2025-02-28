// 主程序 (修改版)
(function() {
  // 等待 DOM 加載完成
  document.addEventListener('DOMContentLoaded', initApp);
  
  // 初始化應用
  async function initApp() {
    console.log('初始化應用...');
    
    try {
      // 初始化用戶界面
      window.UIManager.init();
      
      // 初始化音頻
      await window.AudioManager.init();
      
      // 初始化 Socket 連接
      await window.SocketManager.init();
      
      // 初始化延遲管理
      await window.LatencyManager.init();
      
      // 顯示延遲信息
      displayNetworkInfo();
      
      // 設置事件處理
      setupEventHandlers();
      
      // 設置鍵盤事件
      setupKeyboardEvents();
      
      console.log('應用初始化完成');
    } catch (error) {
      console.error('應用初始化失敗:', error);
      document.getElementById('connectionStatus').textContent = '初始化失敗，請重新整理頁面';
    }
  }
  
  // 顯示網絡延遲信息
  function displayNetworkInfo() {
    const statusElement = document.getElementById('connectionStatus');
    
    if (statusElement && window.LatencyManager) {
      const latency = window.LatencyManager.networkLatency;
      let qualityText = '';
      
      if (latency < 50) {
        qualityText = '極佳';
        statusElement.style.backgroundColor = '#2e7d32'; // 綠色
      } else if (latency < 100) {
        qualityText = '良好';
        statusElement.style.backgroundColor = '#689f38'; // 淺綠色
      } else if (latency < 200) {
        qualityText = '一般';
        statusElement.style.backgroundColor = '#ffa000'; // 橙色
      } else {
        qualityText = '較高';
        statusElement.style.backgroundColor = '#d32f2f'; // 紅色
      }
      
      statusElement.textContent = `連接: 已連接 (延遲: ${latency}ms, ${qualityText})`;
    }
  }
  
  // 設置事件處理
  function setupEventHandlers() {
    // 處理房間加入事件
    window.SocketManager.on('onRoomJoined', (data) => {
      window.UIManager.updateUserCells(data.users);
    });
    
    // 處理用戶加入事件
    window.SocketManager.on('onUserJoined', (data) => {
      window.UIManager.addUserToCell(data.userId, data.position);
    });
    
    // 處理用戶離開事件
    window.SocketManager.on('onUserLeft', (data) => {
      window.UIManager.removeUserFromCell(data.userId);
    });
    
    // 處理打鼓事件 (修改版)
    window.SocketManager.on('onDrumHit', (data) => {
      // 使用延遲補償播放音效
      window.AudioManager.playSound(data.drumType, data.timestamp);
      
      // 高亮格子
      window.UIManager.highlightUserCell(data.userId, data.drumType);
    });
  }
  
  // 設置鍵盤事件 (修改版)
  function setupKeyboardEvents() {
    document.addEventListener('keydown', (e) => {
      // 避免按住鍵時重複觸發
      if (e.repeat) return;
      
      const key = e.key.toLowerCase();
      let drumType = null;
      
      // 鍵盤映射
      switch (key) {
        case 'q':
          drumType = 'kick';
          break;
        case 'w':
          drumType = 'snare';
          break;
        case 'e':
          drumType = 'hihat';
          break;
        case 'r':
          drumType = 'tom';
          break;
        case 't':
          drumType = 'crash';
          break;
      }
      
      if (drumType) {
        // 獲取當前時間戳 (已校正)
        const timestamp = window.LatencyManager.adjustEventTime(Date.now());
        
        // 本地播放音效 (立即)
        window.AudioManager.playSound(drumType);
        
        // 高亮自己的格子
        window.UIManager.highlightUserCell(window.SocketManager.currentUser.id, drumType);
        
        // 發送到服務器
        window.SocketManager.sendDrumHit(drumType);
      }
    });
    
    // 為移動設備添加觸控支持
    addTouchSupport();
  }
  
  // 為移動設備添加觸控支持
  function addTouchSupport() {
    // 檢查是否是移動設備
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      console.log('檢測到移動設備，添加觸控支持');
      
      // 創建觸控按鈕容器
      const touchControls = document.createElement('div');
      touchControls.className = 'touch-controls';
      touchControls.style.display = 'flex';
      touchControls.style.justifyContent = 'center';
      touchControls.style.flexWrap = 'wrap';
      touchControls.style.gap = '10px';
      touchControls.style.margin = '20px 0';
      
      // 添加按鈕
      const drumTypes = [
        { key: 'Q', type: 'kick', color: '#ff5252' },
        { key: 'W', type: 'snare', color: '#ffeb3b' },
        { key: 'E', type: 'hihat', color: '#4caf50' },
        { key: 'R', type: 'tom', color: '#2196f3' },
        { key: 'T', type: 'crash', color: '#e040fb' }
      ];
      
      drumTypes.forEach(drum => {
        const button = document.createElement('button');
        button.textContent = drum.key;
        button.style.width = '60px';
        button.style.height = '60px';
        button.style.borderRadius = '50%';
        button.style.border = 'none';
        button.style.backgroundColor = drum.color;
        button.style.color = '#fff';
        button.style.fontSize = '20px';
        button.style.fontWeight = 'bold';
        button.style.cursor = 'pointer';
        
        // 添加觸控事件
        button.addEventListener('touchstart', (e) => {
          e.preventDefault();
          
          // 模擬按鍵行為
          const timestamp = window.LatencyManager.adjustEventTime(Date.now());
          window.AudioManager.playSound(drum.type);
          window.UIManager.highlightUserCell(window.SocketManager.currentUser.id, drum.type);
          window.SocketManager.sendDrumHit(drum.type);
          
          // 視覺反饋
          button.style.transform = 'scale(0.95)';
          button.style.boxShadow = `0 0 15px ${drum.color}`;
        });
        
        button.addEventListener('touchend', () => {
          button.style.transform = 'scale(1)';
          button.style.boxShadow = 'none';
        });
        
        touchControls.appendChild(button);
      });
      
      // 添加到頁面
      document.querySelector('.container').appendChild(touchControls);
    }
  }
})();