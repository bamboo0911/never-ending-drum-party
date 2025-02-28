// 優化的主程序
(function() {
    // 應用狀態
    const appState = {
      initialized: false,
      audioReady: false,
      socketReady: false,
      uiReady: false,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    };
    
    // 等待DOM加載完成
    document.addEventListener('DOMContentLoaded', initApp);
    
    /**
     * 初始化應用
     */
    async function initApp() {
      console.log('初始化應用...');
      
      try {
        // 首先確保所有必需的模塊都已定義
        if (!window.UIManager) {
          console.error('UI模組未加載');
          showError('UI模組未加載');
          return;
        }
        
        if (!window.AudioManager) {
          console.error('音頻模組未加載');
          showError('音頻模組未加載');
          return;
        }
        
        if (!window.SocketManager) {
          console.error('Socket模組未加載');
          showError('Socket模組未加載');
          return;
        }
        
        // 首先初始化UI（最輕量級且不依賴其他模塊）
        initUI();
        
        // 移除可能的啟動屏幕遮罩
        removeStartupMask();
        
        // 並行初始化音頻和套接字以加快啟動
        await Promise.all([
          initAudio().catch(err => {
            console.warn('音頻初始化警告:', err);
            // 繼續而不回傳錯誤，音頻可能在用戶互動後工作
          }),
          initSocket().catch(err => {
            console.warn('套接字初始化警告:', err);
            // 繼續而不回傳錯誤，可以在離線模式下工作
          })
        ]);
        
        // 設置優化的事件處理程序
        setupOptimizedEventHandlers();
        
        // 初始化優化的事件處理
        initOptimizedEvents();
        
        // 標記應用為已初始化
        appState.initialized = true;
        
        console.log('應用初始化完成');
      } catch (error) {
        console.error('應用初始化失敗:', error);
        showError('初始化失敗，請重新整理頁面');
      }
    }
    
    /**
     * 移除啟動屏幕遮罩（如果存在）
     */
    function removeStartupMask() {
      const mask = document.getElementById('loadingIndicator') || 
                  document.getElementById('audioStartModal');
      if (mask) {
        mask.style.opacity = '0';
        mask.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          if (mask.parentNode) {
            mask.parentNode.removeChild(mask);
          }
        }, 300);
      }
    }
    
    /**
     * 初始化UI
     */
    function initUI() {
      try {
        window.UIManager.init();
        appState.uiReady = true;
        return true;
      } catch (error) {
        console.error('UI初始化失敗:', error);
        return false;
      }
    }
    
    /**
     * 初始化音頻
     * @returns {Promise} 完成時解析
     */
    async function initAudio() {
      // 檢查是否已初始化
      if (appState.audioReady) return true;
      
      try {
        // 添加點擊處理程序以啟動音頻
        if (!appState.audioClickHandlerAdded) {
          document.addEventListener('click', function audioClickHandler() {
            // 只嘗試一次
            document.removeEventListener('click', audioClickHandler);
            
            // 嘗試在點擊後初始化音頻
            if (!appState.audioReady) {
              window.AudioManager.init().then(result => {
                appState.audioReady = result;
                console.log(result ? '音頻已就緒' : '音頻初始化失敗');
              });
            }
          });
          appState.audioClickHandlerAdded = true;
        }
        
        // 嘗試立即初始化（可能因瀏覽器限制而失敗）
        const result = await window.AudioManager.init();
        appState.audioReady = result;
        return result;
      } catch (error) {
        console.warn('音頻初始化失敗 (將在用戶互動後重試):', error);
        return false;
      }
    }
    
    /**
     * 初始化套接字連接
     * @returns {Promise} 完成時解析
     */
    async function initSocket() {
      try {
        const result = await window.SocketManager.init();
        appState.socketReady = result;
        return result;
      } catch (error) {
        console.error('連接初始化失敗:', error);
        return false;
      }
    }
    
    /**
     * 獲取用戶的格子ID
     * @param {string} userId - 用戶ID
     * @returns {string|null} 格子ID或null
     */
    function getCellIdForUser(userId) {
        // 如果是當前用戶，固定回傳 cell-bottom-center
        if (window.SocketManager && userId === window.SocketManager.currentUser?.id) {
        return 'cell-bottom-center';
        }
        
        // 其他用戶透過 UIManager 的 getter 取得對應格子ID
        if (window.UIManager && typeof window.UIManager.getCellId === 'function') {
        return window.UIManager.getCellId(userId);
        }
        
        return null;
    }
    
    /**
     * 直接閃爍格子，不使用UIManager
     * @param {string} cellId - 格子ID
     * @param {string} drumType - 鼓類型
     */
    function flashCellDirectly(cellId, drumType) {
      const cell = document.getElementById(cellId);
      if (!cell) return;
      
      // 映射鼓類型到顏色
      const colors = {
        'kick': '#ff5252',
        'snare': '#ffeb3b',
        'hihat': '#4caf50',
        'tom': '#2196f3',
        'crash': '#e040fb',
        'default': '#ffcc00'
      };
      
      const color = colors[drumType] || colors.default;
      
      // 取消任何現有的timeout
      if (cell._flashTimeout) {
        clearTimeout(cell._flashTimeout);
      }
      
      // 記錄原始背景色（如果尚未記錄）
      if (!cell._originalBg) {
        cell._originalBg = window.getComputedStyle(cell).backgroundColor;
      }
      
      // 直接設置背景色
      cell.style.backgroundColor = color;
      
      // 設定極短的timeout以恢復原色
      cell._flashTimeout = setTimeout(() => {
        cell.style.backgroundColor = cell._originalBg || '';
        cell._flashTimeout = null;
      }, 50);
    }
    
    /**
     * 優化的事件處理設置
     * 用於處理從其他用戶接收的事件
     */
    function setupOptimizedEventHandlers() {
      // 只有當SocketManager準備好時才設置
      if (!window.SocketManager) {
        console.warn('無法設置事件處理：SocketManager未定義');
        return;
      }
      
      // 使用高性能的事件映射而非多個事件處理器
      const eventHandlers = {
        // 房間加入處理程序
        onRoomJoined: (data) => {
          if (window.UIManager && data && data.users) {
            window.UIManager.updateUserCells(data.users);
          }
        },
        
        // 用戶加入處理程序
        onUserJoined: (data) => {
          if (window.UIManager && data && data.userId && data.position) {
            window.UIManager.addUserToCell(data.userId, data.position);
          }
        },
        
        // 用戶離開處理程序
        onUserLeft: (data) => {
          if (window.UIManager && data && data.userId) {
            window.UIManager.removeUserFromCell(data.userId);
          }
        },
        
        // 鼓點處理程序 - 高度優化
        onDrumHit: (data) => {
          if (!data || !data.drumType || !data.userId) return;
          
          // 1. 立即播放聲音（最高優先級）
          if (window.AudioManager) {
            // 立即播放聲音，不等待視覺更新
            window.AudioManager.playSound(data.drumType);
          }
          
          // 2. 視覺更新（次優先級）
          // 獲取對應的格子ID
          const cellId = getCellIdForUser(data.userId);
          if (cellId) {
            // 直接更新DOM，避免任何額外處理
            flashCellDirectly(cellId, data.drumType);
          }
        }
      };
      
      // 註冊所有事件處理器
      for (const [event, handler] of Object.entries(eventHandlers)) {
        window.SocketManager.on(event, handler);
      }
    }
    
    /**
     * 處理輸入事件（優先處理聲音）
     * @param {string} drumType - 鼓類型
     */
    function handleDrumInput(drumType) {
      if (!drumType) return;
      
      // 1. 立即播放聲音（最高優先級）
      if (window.AudioManager) {
        window.AudioManager.playSound(drumType);
      }
      
      // 2. 微小延遲後更新視覺（幾乎無法察覺）
      const cellId = 'cell-bottom-center'; // 當前用戶的格子
      const cell = document.getElementById(cellId);
      
      if (cell) {
        // 獲取對應顏色
        const colors = {
          'kick': '#ff5252',
          'snare': '#ffeb3b',
          'hihat': '#4caf50',
          'tom': '#2196f3',
          'crash': '#e040fb'
        };
        
        // 直接設置背景色（無過渡）
        cell.style.backgroundColor = colors[drumType] || '#ffcc00';
        
        // 極短時間後恢復原色
        setTimeout(() => {
          cell.style.backgroundColor = '';
        }, 50); // 只閃50毫秒
      }
      
      // 3. 最後發送網絡事件（最低優先級）
      if (window.SocketManager) {
        setTimeout(() => {
          window.SocketManager.sendDrumHit(drumType);
        }, 0); // 使用零延時將網絡操作移到下一個事件循環
      }
    }
    
    /**
     * 優化的鍵盤處理（使用keydown事件捕獲階段）
     */
    function setupOptimizedKeyboardEvents() {
      // 使用捕獲階段獲取最早的事件處理機會
      document.addEventListener('keydown', (e) => {
        // 避免按住鍵時重複觸發
        if (e.repeat) return;
        
        const key = e.key.toLowerCase();
        let drumType = null;
        
        // 映射鍵盤按鍵到鼓類型
        switch (key) {
          case 'q': drumType = 'kick'; break;
          case 'w': drumType = 'snare'; break;
          case 'e': drumType = 'hihat'; break;
          case 'r': drumType = 'tom'; break;
          case 't': drumType = 'crash'; break;
        }
        
        if (drumType) {
          handleDrumInput(drumType);
        }
      }, true); // true表示捕獲階段，比冒泡階段更早執行
    }
    
    /**
     * 優化的移動觸摸處理
     */
    function setupOptimizedTouchControls() {
      // 創建觸摸控制容器
      const touchControls = document.createElement('div');
      touchControls.className = 'touch-controls';
      touchControls.style.display = 'flex';
      touchControls.style.justifyContent = 'center';
      touchControls.style.flexWrap = 'wrap';
      touchControls.style.gap = '8px';
      touchControls.style.margin = '20px 0';
      
      // 添加按鈕
      const drumTypes = [
        { key: 'Q', type: 'kick', color: '#ff5252' },
        { key: 'W', type: 'snare', color: '#ffeb3b' },
        { key: 'E', type: 'hihat', color: '#4caf50' },
        { key: 'R', type: 'tom', color: '#2196f3' },
        { key: 'T', type: 'crash', color: '#e040fb' }
      ];
      
      // 使用強制DOM內聯樣式以減少CSS查詢時間
      drumTypes.forEach(drum => {
        const button = document.createElement('button');
        button.textContent = drum.key;
        button.setAttribute('data-drum-type', drum.type);
        
        // 直接設置所有樣式屬性
        Object.assign(button.style, {
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: drum.color,
          color: '#fff',
          fontSize: '20px',
          fontWeight: 'bold',
          cursor: 'pointer',
          userSelect: 'none',
          webkitUserSelect: 'none',
          webkitTapHighlightColor: 'transparent', // 移除iOS的點擊高亮
          touchAction: 'manipulation' // 優化觸摸行為
        });
        
        // 使用觸摸事件而非點擊事件（觸摸事件更快）
        button.addEventListener('touchstart', (e) => {
          // 阻止默認行為（可能導致延遲）
          e.preventDefault();
          
          // 立即處理輸入
          handleDrumInput(drum.type);
          
          // 視覺反饋
          button.style.opacity = '0.8';
        }, { passive: false });
        
        button.addEventListener('touchend', () => {
          button.style.opacity = '1';
        }, { passive: true });
        
        touchControls.appendChild(button);
      });
      
      // 添加到頁面
      const container = document.querySelector('.container');
      if (container) {
        container.appendChild(touchControls);
      }
    }
    
    // 初始化優化的事件處理
    function initOptimizedEvents() {
      setupOptimizedKeyboardEvents();
      
      // 如果是移動設備，設置觸摸控制
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        setupOptimizedTouchControls();
      }
    }
    
    /**
     * 顯示錯誤消息
     * @param {string} message - 錯誤消息
     */
    function showError(message) {
      // 嘗試在連接狀態中顯示
      const statusElement = document.getElementById('connectionStatus');
      if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.backgroundColor = '#d32f2f';
      }
      
      // 同時顯示警報
      alert('錯誤: ' + message);
    }
  })();