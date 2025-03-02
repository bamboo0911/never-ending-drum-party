// Improved Socket Manager with better room synchronization
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
      id: 'default-room',
      users: []  // 存储房间用户列表
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
      if (!socket) return;
  
      // Room joined
      socket.on('room-joined', (data) => {
        console.log('[Socket] 已加入房間', data);
        if (!data || !data.users) {
          console.error('[Socket] 房間數據無效:', data);
          return;
        }
        
        // 更新房間數據
        currentRoom.users = data.users;
        
        updateRoomInfo(`房間: ${currentRoom.id} (${data.users.length} 人在線)`);
        triggerCallback('onRoomJoined', data);
        
        // 觸發 room-joined 事件讓其他模塊知道
        triggerCallback('room-joined', data);
      });
  
      // User joined
      socket.on('user-joined', (data) => {
        console.log('[Socket] 用戶加入:', data);
        if (!data || !data.userId) {
          console.error('[Socket] 用戶數據無效:', data);
          return;
        }
        
        // 添加用戶到房間列表
        if (currentRoom.users) {
          const userExists = currentRoom.users.some(u => u.id === data.userId);
          if (!userExists) {
            currentRoom.users.push({
              id: data.userId,
              name: data.name,
              position: data.position,
              drumType: data.drumType
            });
          }
        }
        
        updateRoomInfo(`房間: ${currentRoom.id} (${currentRoom.users.length} 人在線)`);
        triggerCallback('onUserJoined', data);
        
        // 觸發 user-joined 事件讓其他模塊知道
        triggerCallback('user-joined', data);
      });
  
      // User left
      socket.on('user-left', (data) => {
        console.log('[Socket] 用戶離開:', data);
        if (!data || !data.userId) {
          console.error('[Socket] 用戶數據無效:', data);
          return;
        }
        
        // 從房間列表移除用戶
        if (currentRoom.users) {
          currentRoom.users = currentRoom.users.filter(u => u.id !== data.userId);
        }
        
        updateRoomInfo(`房間: ${currentRoom.id} (${currentRoom.users ? currentRoom.users.length : 0} 人在線)`);
        triggerCallback('onUserLeft', data);
        
        // 觸發 user-left 事件讓其他模塊知道
        triggerCallback('user-left', data);
      });
  
      // Drum hit
      socket.on('drum-hit', (data) => {
        console.log('[Socket] 收到打鼓:', data);
        if (!data || !data.drumType) {
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
      
      // Host assigned
      socket.on('host-assigned', (data) => {
        console.log('[Socket] 收到房主分配:', data);
        triggerCallback('host-assigned', data);
      });
      
      // Host status
      socket.on('host-status', (data) => {
        console.log('[Socket] 收到房主狀態:', data);
        triggerCallback('host-status', data);
      });
      
      // Host changed
      socket.on('host-changed', (data) => {
        console.log('[Socket] 收到房主變更:', data);
        triggerCallback('host-changed', data);
      });
      
      // Circle started
      socket.on('circle-started', (data) => {
        console.log('[Socket] 收到鼓圈開始:', data);
        triggerCallback('circle-started', data);
      });
      
      // Circle stopped
      socket.on('circle-stopped', () => {
        console.log('[Socket] 收到鼓圈停止');
        triggerCallback('circle-stopped', {});
      });
      
      // Room users
      socket.on('room-users', (data) => {
        console.log('[Socket] 收到房間用戶列表:', data);
        if (data && Array.isArray(data.users)) {
          currentRoom.users = data.users;
          triggerCallback('room-users-updated', data);
        }
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
      if (!roomId) {
        console.error('[Socket] 房間ID無效');
        return;
      }
      currentRoom.id = roomId;
  
      // Send join room request with complete user info
      socket.emit('join-room', {
        roomId: currentRoom.id,
        userId: currentUser.id,
        name: currentUser.name || 'User-' + currentUser.id.substring(0, 5),
        drumType: currentUser.drumType
      });
  
      console.log(`[Socket] 正在加入房間: ${roomId}`);
      updateRoomInfo(`房間: ${roomId} (加入中...)`);
      
      // 清空當前房間用戶列表，等待服務器發送完整列表
      currentRoom.users = [];
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
      if (!drumType) {
        console.error('[Socket] 鼓類型無效');
        return false;
      }
      try {
        const timestamp = window.LatencyManager && window.LatencyManager.isReady
          ? window.LatencyManager.adjustEventTime(Date.now())
          : Date.now();
        socket.emit('drum-hit', {
          drumType: drumType,
          timestamp: timestamp
        });
        return true;
      } catch (error) {
        console.error('[Socket] 發送打鼓事件失敗:', error);
        return false;
      }
    }
  
    /**
     * Update connection status display and indicator
     * @param {string} status - Status message
     * @param {boolean} isConnected - Connection status
     */
    function updateConnectionStatus(status, isConnected) {
      const statusElement = document.getElementById('connectionStatus');
      if (statusElement) {
        statusElement.textContent = `狀態: ${status}`;
        statusElement.style.backgroundColor = isConnected ? '#2e7d32' : '#c62828';
      }
      updateConnectionIndicator(isConnected);
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
      if (!eventName || typeof callback !== 'function') {
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
      if (!drumType) {
        console.error('[Socket] 鼓類型無效');
        return;
      }
      currentUser.drumType = drumType;
    }
    
    /**
     * Set current user's name
     * @param {string} name - User name
     */
    function setUserName(name) {
      if (!name) {
        console.error('[Socket] 用戶名稱無效');
        return;
      }
      currentUser.name = name;
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
        const timeoutId = setTimeout(() => {
          socket.off('server-time', timeHandler);
          reject(new Error('[Socket] 時間同步請求超時'));
        }, 3000);
        const timeHandler = (data) => {
          if (requestId && data.requestId && data.requestId !== requestId) {
            return;
          }
          clearTimeout(timeoutId);
          socket.off('server-time', timeHandler);
          resolve(data);
        };
        socket.on('server-time', timeHandler);
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
      
      currentUser.drumType = newInstrument;
      
      socket.emit('change-instrument', {
        userId: currentUser.id,
        drumType: newInstrument
      });
    }
  
    /**
     * Update connection indicator (displayed at the right top corner)
     * @param {boolean} isConnected - Connection status
     */
    function updateConnectionIndicator(isConnected) {
      const indicator = document.getElementById('connectionIndicator');
      if (indicator) {
        indicator.style.backgroundColor = isConnected ? 'green' : 'red';
      }
    }
    
    /**
     * 發送特定事件到伺服器
     * @param {string} eventName - 事件名稱
     * @param {object} data - 事件數據
     * @returns {boolean} 成功狀態
     */
    function emitEvent(eventName, data) {
      if (!socket || !isConnected) {
        console.warn(`[Socket] 無法發送 ${eventName} 事件: 未連接到服務器`);
        return false;
      }
      
      try {
        socket.emit(eventName, data);
        console.log(`[Socket] 已發送 ${eventName} 事件:`, data);
        return true;
      } catch (error) {
        console.error(`[Socket] 發送 ${eventName} 事件失敗:`, error);
        return false;
      }
    }
    
    /**
     * 請求房間中的所有用戶
     */
    function requestRoomUsers() {
      if (!socket || !isConnected) {
        console.warn('[Socket] 無法請求房間用戶: 未連接到服務器');
        return false;
      }
      
      socket.emit('request-room-users');
      console.log('[Socket] 已請求房間用戶列表');
      return true;
    }
    
    /**
     * 獲取房間中的所有用戶
     * @returns {Array} 用戶列表
     */
    function getRoomParticipants() {
      return currentRoom.users || [];
    }
  
    // Public API
    return {
      init,
      currentUser,
      currentRoom,
      sendDrumHit,
      on,
      setDrumType,
      setUserName,
      requestServerTime,
      isConnected: isSocketConnected,
      changeInstrument,
      emitEvent,
      requestRoomUsers,
      getRoomParticipants,
      // 暴露 socket 的接口方法 - 安全地訪問 socket
      emit: function(eventName, data) {
        if (!socket) {
          console.warn(`[Socket] 無法發送 ${eventName}: socket 未初始化`);
          return false;
        }
        return socket.emit(eventName, data);
      }
    };
  })();
  
  // Export module
  window.SocketManager = SocketManager;