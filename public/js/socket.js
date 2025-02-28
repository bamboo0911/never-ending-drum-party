// Simplified Socket Manager
const SocketManager = (function() {
    // Socket.io instance
    let socket;
    // Current user info
    const currentUser = {
      id: 'user-' + Math.floor(Math.random() * 10000),
      position: 'bottom-center', 
      drumType: 'kick'
    };
    // Current room info
    const currentRoom = {
      id: 'default-room'
    };
    // Event listeners
    const eventListeners = {};
    // Connection status
    let isConnected = false;
    // Reconnection settings
    const MAX_RECONNECT_ATTEMPTS = 3;
    let reconnectAttempts = 0;
    let reconnectTimeout = null;
  
    /**
     * Initialize Socket.io connection
     * @returns {Promise} Resolution indicates success
     */
    function init() {
      return new Promise((resolve, reject) => {
        try {
          // Check if Socket.io is loaded
          if (typeof io === 'undefined') {
            console.error('[Socket] Socket.io 未加載');
            updateConnectionStatus('Socket.io 未加載', false);
            reject(new Error('Socket.io not loaded'));
            return;
          }
          
          // Create connection
          socket = io();
          
          // Connection successful
          socket.on('connect', () => {
            console.log('[Socket] 已連接到服務器');
            updateConnectionStatus('已連接', true);
            isConnected = true;
            reconnectAttempts = 0;
            
            // Join default room
            joinRoom(currentRoom.id);
            resolve(true);
          });
          
          // Connection error
          socket.on('connect_error', (error) => {
            console.error('[Socket] 連接錯誤:', error);
            updateConnectionStatus('連接失敗', false);
            
            // Try to reconnect
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++;
              updateConnectionStatus(`連接失敗，重試中 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, false);
              
              // Clear existing timeout
              if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
              }
              
              // Set new timeout
              reconnectTimeout = setTimeout(() => {
                socket.connect();
              }, 2000);
            } else {
              reject(error);
            }
          });
          
          // Disconnection
          socket.on('disconnect', () => {
            console.log('[Socket] 與服務器斷開連接');
            updateConnectionStatus('已斷開', false);
            isConnected = false;
          });
          
          // Setup event listeners
          setupEventListeners();
        } catch (error) {
          console.error('[Socket] 初始化 Socket.io 失敗:', error);
          updateConnectionStatus('初始化失敗', false);
          reject(error);
        }
      });
    }
  
    /**
     * Setup event listeners
     */
    function setupEventListeners() {
      // Make sure socket exists
      if (!socket) return;
      
      // Room joined
      socket.on('room-joined', (data) => {
        console.log('[Socket] 已加入房間', data);
        if(!data || !data.users) {
          console.error('[Socket] 房間數據無效:', data);
          return;
        }
        updateRoomInfo(`房間: ${currentRoom.id} (${data.users.length} 人在線)`);
        
        // Trigger callback
        triggerCallback('onRoomJoined', data);
      });
      
      // User joined
      socket.on('user-joined', (data) => {
        console.log('[Socket] 用戶加入:', data);
        if(!data || !data.userId) {
          console.error('[Socket] 用戶數據無效:', data);
          return;
        }
        
        triggerCallback('onUserJoined', data);
      });
      
      // User left
      socket.on('user-left', (data) => {
        console.log('[Socket] 用戶離開:', data);
        if(!data || !data.userId) {
          console.error('[Socket] 用戶數據無效:', data);
          return;
        }
        
        triggerCallback('onUserLeft', data);
      });
      
      // Drum hit
      socket.on('drum-hit', (data) => {
        console.log('[Socket] 收到打鼓:', data);
        if(!data || !data.drumType) {
          console.error('[Socket] 打鼓數據無效:', data);
          return;
        }
        
        triggerCallback('onDrumHit', data);
      });
      
      // Error
      socket.on('error', (error) => {
        console.error('[Socket] 服務器錯誤:', error);
        triggerCallback('onError', error);
      });
      
      // Server time
      socket.on('server-time', (data) => {
        if (!data || typeof data.serverTime !== 'number') {
          console.error('[Socket] 服務器時間數據無效:', data);
          return;
        }
        
        triggerCallback('onServerTime', data);
      });
    }
  
    /**
     * Join a room
     * @param {string} roomId - Room ID
     */
    function joinRoom(roomId) {
      if (!socket || !isConnected) {
        console.error('[Socket] 無法加入房間: 未連接到服務器');
        return;
      }
      
      if(!roomId) {
        console.error('[Socket] 房間ID無效');
        return;
      }
      
      currentRoom.id = roomId;
      
      // Send join room request
      socket.emit('join-room', {
        roomId: currentRoom.id,
        userId: currentUser.id,
        name: currentUser.name,       
        drumType: currentUser.drumType 
      });
      
      console.log(`[Socket] 正在加入房間: ${roomId}`);
      updateRoomInfo(`房間: ${roomId} (加入中...)`);
    }
  
    /**
     * Send drum hit event
     * @param {string} drumType - Drum type
     * @returns {boolean} Success status
     */
    function sendDrumHit(drumType) {
      if (!socket || !isConnected) {
        console.warn('[Socket] 無法發送打鼓事件: 未連接到服務器');
        return false;
      }
      
      if(!drumType) {
        console.error('[Socket] 鼓類型無效');
        return false;
      }
      
      try {
        // Use current time if LatencyManager is not available
        const timestamp = window.LatencyManager && window.LatencyManager.isReady 
          ? window.LatencyManager.adjustEventTime(Date.now()) 
          : Date.now();
        
        // Send to server
        socket.emit('drum-hit', {
          drumType: drumType,
          timestamp: timestamp
        });
        
        return true;
      } catch(error) {
        console.error('[Socket] 發送打鼓事件失敗:', error);
        return false;
      }
    }
  
    /**
     * Update connection status display
     * @param {string} status - Status message
     * @param {boolean} isConnected - Connection status
     */
    function updateConnectionStatus(status, isConnected) {
      const statusElement = document.getElementById('connectionStatus');
      if (statusElement) {
        statusElement.textContent = `狀態: ${status}`;
        statusElement.style.backgroundColor = isConnected ? '#2e7d32' : '#c62828';
      }
    }
  
    /**
     * Update room info display
     * @param {string} info - Room info
     */
    function updateRoomInfo(info) {
      const infoElement = document.getElementById('roomInfo');
      if (infoElement) {
        infoElement.textContent = info;
      }
    }
  
    /**
     * Register event listener
     * @param {string} eventName - Event name
     * @param {Function} callback - Callback function
     */
    function on(eventName, callback) {
      if(!eventName || typeof callback !== 'function') {
        console.error('[Socket] 無效的事件監聽器參數');
        return;
      }
      eventListeners[eventName] = callback;
    }
  
    /**
     * Trigger registered callback
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     */
    function triggerCallback(eventName, data) {
      if (eventListeners[eventName]) {
        try {
          eventListeners[eventName](data);
        } catch (error) {
          console.error(`[Socket] 執行事件回調 ${eventName} 時出錯:`, error);
        }
      }
    }
  
    /**
     * Set current user's drum type
     * @param {string} drumType - Drum type
     */
    function setDrumType(drumType) {
      if(!drumType) {
        console.error('[Socket] 鼓類型無效');
        return;
      }
      currentUser.drumType = drumType;
    }
  
    /**
     * Request server time
     * @param {string} requestId - Optional request ID
     * @returns {Promise} Resolution provides server time
     */
    function requestServerTime(requestId) {
      return new Promise((resolve, reject) => {
        if (!socket || !isConnected) {
          reject(new Error('[Socket] 未連接到服務器'));
          return;
        }
        
        // Setup one-time listener for this specific request
        const timeoutId = setTimeout(() => {
          socket.off('server-time', timeHandler);
          reject(new Error('[Socket] 時間同步請求超時'));
        }, 3000);
        
        const timeHandler = (data) => {
          // Check if this is our response (if requestId was provided)
          if (requestId && data.requestId && data.requestId !== requestId) {
            return; // Not our response
          }
          
          // Clear timeout and remove listener
          clearTimeout(timeoutId);
          socket.off('server-time', timeHandler);
          
          resolve(data);
        };
        
        // Add temporary listener
        socket.on('server-time', timeHandler);
        
        // Send request
        socket.emit('request-server-time', { requestId });
      });
    }
  
    /**
     * Check if connected to server
     * @returns {boolean} Connection status
     */
    function isSocketConnected() {
      return isConnected;
    }

    /**
     * Change instrument
     * @param {string} newInstrument - New instrument type
     */
    function changeInstrument(newInstrument) {
      if (!socket || !isConnected) {
        console.warn('[Socket] 無法發送更換樂器事件: 未連接到服務器');
        return;
      }
      // 發送更換樂器事件，包含使用者 ID 與新樂器資訊
      socket.emit('change-instrument', {
        userId: currentUser.id,
        drumType: newInstrument
      });
    }
  
    // Public API
    return {
      init,
      currentUser,
      currentRoom,
      sendDrumHit,
      on,
      setDrumType,
      requestServerTime,
      isConnected: isSocketConnected,
      changeInstrument
    };
  })();
  
  // Export module
  window.SocketManager = SocketManager;