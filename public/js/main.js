// 優化的主程序 - 增強房間同步功能
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

    // 新增：監聽「更換樂器」選單變更事件
    function setupInstrumentChange() {
      const changeSelect = document.getElementById('changeInstrumentSelect');
      if (!changeSelect) return;
      
      changeSelect.addEventListener('change', (e) => {
        const newInstrument = e.target.value;
        console.log("更換樂器為:", newInstrument);
        
        // 更新當前用戶設定
        if (window.SocketManager && window.SocketManager.currentUser) {
          window.SocketManager.currentUser.drumType = newInstrument;
        }
        
        // (選擇性) 通知伺服器：發送「更換樂器」事件
        if (window.SocketManager && typeof window.SocketManager.changeInstrument === 'function') {
          window.SocketManager.changeInstrument(newInstrument);
        }
      });
    }
    
    /**
     * 初始化應用
     */
    async function initApp() {
      console.log('初始化應用...');
      
      // 讀取玩家設定，若未設定則提示返回設定頁面
      const playerName = localStorage.getItem('playerName');
      const instrument = localStorage.getItem('instrument');
      if (!playerName || !instrument) {
        alert("請先完成玩家設定");
        window.location.href = '/config.html';
        return;
      }
      
      // 更新 SocketManager.currentUser 資訊
      if (window.SocketManager && window.SocketManager.currentUser) {
        window.SocketManager.currentUser.name = playerName;
        window.SocketManager.currentUser.drumType = instrument;
        
        // 確保設置用戶名
        if (typeof window.SocketManager.setUserName === 'function') {
          window.SocketManager.setUserName(playerName);
        }
      }
      
      try {
        // 初始化 UI
        initUI();
        removeStartupMask();
        
        // 並行初始化音頻與套接字
        await Promise.all([
          initAudio().catch(err => {
            console.warn('音頻初始化警告:', err);
          }),
          initSocket().catch(err => {
            console.warn('套接字初始化警告:', err);
          })
        ]);
        
        // 設置優化的事件處理程序
        setupOptimizedEventHandlers();
        initOptimizedEvents();
        
        // 新增：設定更換樂器選單事件監聽
        setupInstrumentChange();
        
        // 初始化房主管理器
        if (window.HostManager) {
          window.HostManager.init();
        }
        
        // 設置定期同步房間用戶
        setupRoomSync();
        
        appState.initialized = true;
        console.log('應用初始化完成');
      } catch (error) {
        console.error('應用初始化失敗:', error);
        showError('初始化失敗，請重新整理頁面');
      }
    }
    
    /**
     * 設置房間同步機制
     */
    function setupRoomSync() {
      // 初始請求房間用戶（等待 2 秒確保加入房間完成）
      setTimeout(() => {
        if (window.SocketManager && typeof window.SocketManager.requestRoomUsers === 'function') {
          console.log('初始請求房間用戶列表...');
          window.SocketManager.requestRoomUsers();
        }
      }, 2000);
      
      // 設置定期同步（每 10 秒）
      setInterval(() => {
        if (window.SocketManager && typeof window.SocketManager.requestRoomUsers === 'function') {
          console.log('定期同步房間用戶列表...');
          window.SocketManager.requestRoomUsers();
        }
      }, 10000);
      
      // 監聽房間用戶更新事件
      if (window.SocketManager) {
        window.SocketManager.on('room-users', function(data) {
          console.log('收到房間用戶更新:', data);
          
          // 觸發 UI 更新
          if (window.UIManager && typeof window.UIManager.updateUserCells === 'function' && data.users) {
            window.UIManager.updateUserCells(data.users);
          }
        });
        
        // 監聽強制同步事件
        window.SocketManager.on('room-users-sync', function(data) {
          console.log('收到強制房間同步:', data);
          
          // 觸發 UI 更新
          if (window.UIManager && typeof window.UIManager.updateUserCells === 'function' && data.users) {
            window.UIManager.updateUserCells(data.users);
          }
          
          // 更新房主指示器
          if (window.HostManager && typeof window.HostManager.updateHostIndicators === 'function' && data.hostId) {
            setTimeout(() => {
              window.HostManager.updateHostIndicators();
            }, 300);
          }
        });
      }
    }
    
    /**
     * 移除啟動屏幕遮罩
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
     * @returns {Promise}
     */
    async function initAudio() {
      if (appState.audioReady) return true;
      
      if (!appState.audioClickHandlerAdded) {
        document.addEventListener('click', function audioClickHandler() {
          document.removeEventListener('click', audioClickHandler);
          if (!appState.audioReady) {
            window.AudioManager.init().then(result => {
              appState.audioReady = result;
              console.log(result ? '音頻已就緒' : '音頻初始化失敗');
            });
          }
        });
        appState.audioClickHandlerAdded = true;
      }
      
      const result = await window.AudioManager.init();
      appState.audioReady = result;
      return result;
    }
    
    /**
     * 初始化套接字連接
     * @returns {Promise}
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
      if (window.SocketManager && userId === window.SocketManager.currentUser?.id) {
        return 'cell-bottom-center';
      }
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
      
      const colors = {
        'kick': '#ff5252',
        'snare': '#ffeb3b',
        'hihat': '#4caf50',
        'tom': '#2196f3',
        'crash': '#e040fb',
        'default': '#ffcc00'
      };
      const color = colors[drumType] || colors.default;
      
      if (cell._flashTimeout) {
        clearTimeout(cell._flashTimeout);
      }
      if (!cell._originalBg) {
        cell._originalBg = window.getComputedStyle(cell).backgroundColor;
      }
      
      cell.style.backgroundColor = color;
      cell._flashTimeout = setTimeout(() => {
        cell.style.backgroundColor = cell._originalBg || '';
        cell._flashTimeout = null;
      }, 50);
    }
    
    /**
     * 優化的事件處理設置
     */
    function setupOptimizedEventHandlers() {
      if (!window.SocketManager) {
        console.warn('無法設置事件處理：SocketManager未定義');
        return;
      }
      
      const eventHandlers = {
        onRoomJoined: (data) => {
          if (window.UIManager && data && data.users) {
            window.UIManager.updateUserCells(data.users);
          }
        },
        onUserJoined: (data) => {
          // 傳入完整的用戶物件（包含 name 與 drumType）
          if (window.UIManager && data) {
            window.UIManager.addUserToCell(data);
          }
          
          // 請求完整的房間用戶列表
          if (window.SocketManager && typeof window.SocketManager.requestRoomUsers === 'function') {
            setTimeout(() => {
              window.SocketManager.requestRoomUsers();
            }, 500);
          }
        },
        onUserLeft: (data) => {
          if (window.UIManager && data && data.userId) {
            window.UIManager.removeUserFromCell(data.userId);
          }
        },
        onDrumHit: (data) => {
          if (!data || !data.drumType || !data.userId) return;
          
          if (window.AudioManager) {
            window.AudioManager.playSound(data.drumType);
          }
          
          const cellId = getCellIdForUser(data.userId);
          if (cellId) {
            flashCellDirectly(cellId, data.drumType);
          }
        }
      };
      
      for (const [event, handler] of Object.entries(eventHandlers)) {
        window.SocketManager.on(event, handler);
      }
    }
    
    /**
     * 處理打擊輸入：使用當前玩家設定的固定樂器
     */
    function handleDrumInput() {
      if (!window.SocketManager || !window.SocketManager.currentUser) return;
      const instrument = window.SocketManager.currentUser.drumType;
      
      // 立即播放音效
      if (window.AudioManager) {
        window.AudioManager.playSound(instrument);
      }
      
      // 更新當前用戶視覺 (cell-bottom-center)
      const cell = document.getElementById('cell-bottom-center');
      if (cell) {
        const colors = {
          'kick': '#ff5252',
          'snare': '#ffeb3b',
          'hihat': '#4caf50',
          'tom': '#2196f3',
          'crash': '#e040fb'
        };
        cell.style.backgroundColor = colors[instrument] || '#ffcc00';
        setTimeout(() => {
          cell.style.backgroundColor = '';
        }, 50);
      }
      
      // 發送打擊事件
      if (window.SocketManager) {
        window.SocketManager.sendDrumHit(instrument);
      }
    }
    
    /**
     * 優化的鍵盤處理：只監聽 F 與 K 鍵
     */
    function setupOptimizedKeyboardEvents() {
      document.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        const key = e.key.toLowerCase();
        if (key === 'f' || key === 'j') {
          handleDrumInput();
        }
      }, true);
    }
    
    /**
     * 初始化觸控事件（如有需要，可調整）
     */
    function setupOptimizedTouchControls() {
      // 依需求實作移動設備觸控控制
    }
    
    function initOptimizedEvents() {
      setupOptimizedKeyboardEvents();
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        setupOptimizedTouchControls();
      }
    }
    
    /**
     * 顯示錯誤消息
     */
    function showError(message) {
      const statusElement = document.getElementById('connectionStatus');
      if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.backgroundColor = '#d32f2f';
      }
      alert('錯誤: ' + message);
    }
    
    // 暴露一些有用的公共 API 到 window
    window.DrumParty = {
      forceSync: function() {
        if (window.SocketManager && typeof window.SocketManager.requestRoomUsers === 'function') {
          window.SocketManager.requestRoomUsers();
          return '已请求同步房间成员';
        }
        return '无法同步，SocketManager不可用';
      },
      refreshUI: function() {
        if (window.UIManager && typeof window.UIManager.forceRefreshCells === 'function') {
          window.UIManager.forceRefreshCells();
          return '已刷新UI';
        }
        return 'UIManager不可用';
      },
      debug: function() {
        return {
          appState,
          socket: window.SocketManager ? {
            connected: window.SocketManager.isConnected(),
            room: window.SocketManager.currentRoom,
            user: window.SocketManager.currentUser,
            participants: window.SocketManager.getRoomParticipants ? 
              window.SocketManager.getRoomParticipants() : 'unavailable'
          } : 'SocketManager unavailable',
          host: window.HostManager ? {
            isHost: window.HostManager.isUserHost(),
            hostId: window.HostManager.getCurrentHostId(),
            isPlaying: window.HostManager.isCirclePlaying()
          } : 'HostManager unavailable',
          ui: window.UIManager ? 'available' : 'unavailable',
          audio: window.AudioManager ? 'available' : 'unavailable'
        };
      }
    };
  })();