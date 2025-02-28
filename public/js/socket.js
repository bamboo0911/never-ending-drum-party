// Socket 連接管理模組
const SocketManager = (function() {
    // Socket.io 實例
    let socket;
    // 當前用戶資訊
    const currentUser = {
      id: 'user-' + Math.floor(Math.random() * 10000),
      position: 'bottom-center', 
      drumType: 'kick'
    };
    // 當前房間資訊
    const currentRoom = {
      id: 'default-room'
    };
    // 事件監聽器
    const eventListeners = {};
    // 時間同步 Promise 解析器
    let timePromiseResolve = null;
  
    // 初始化 Socket.io 連接
    function init() {
      return new Promise((resolve, reject) => {
        try {
          // 創建連接
          socket = io();
          
          // 連接建立成功
          socket.on('connect', () => {
            console.log('[Socket] 已連接到服務器');
            updateConnectionStatus('已連接', true);
            
            // 加入默認房間
            joinRoom(currentRoom.id);
            resolve(true);
          });
          
          // 連接出錯
          socket.on('connect_error', (error) => {
            console.error('[Socket] 連接錯誤:', error);
            updateConnectionStatus('連接失敗', false);
            reject(error);
          });
          
          // 斷開連接
          socket.on('disconnect', () => {
            console.log('[Socket] 與服務器斷開連接');
            updateConnectionStatus('已斷開', false);
          });
          
          // 設置事件監聽
          setupEventListeners();
        } catch (error) {
          console.error('[Socket] 初始化 Socket.io 失敗:', error);
          updateConnectionStatus('初始化失敗', false);
          reject(error);
        }
      });
    }
  
    // 設置事件監聽
    function setupEventListeners() {
      // 成功加入房間
      socket.on('room-joined', (data) => {
        console.log('[Socket] 已加入房間', data);
        if(!data || !data.users) {
          console.error('[Socket] 房間數據無效:', data);
          return;
        }
        updateRoomInfo(`房間: ${currentRoom.id} (${data.users.length} 人在線)`);
        
        // 更新用戶列表
        if (eventListeners.onRoomJoined) {
          eventListeners.onRoomJoined(data);
        }
      });
      
      // 其他用戶加入
      socket.on('user-joined', (data) => {
        console.log('[Socket] 用戶加入:', data);
        if(!data || !data.userId) {
          console.error('[Socket] 用戶數據無效:', data);
          return;
        }
        
        if (eventListeners.onUserJoined) {
          eventListeners.onUserJoined(data);
        }
      });
      
      // 用戶離開
      socket.on('user-left', (data) => {
        console.log('[Socket] 用戶離開:', data);
        if(!data || !data.userId) {
          console.error('[Socket] 用戶數據無效:', data);
          return;
        }
        
        if (eventListeners.onUserLeft) {
          eventListeners.onUserLeft(data);
        }
      });
      
      // 接收打鼓事件
      socket.on('drum-hit', (data) => {
        console.log('[Socket] 收到打鼓:', data);
        if(!data || !data.drumType || !data.timestamp) {
          console.error('[Socket] 打鼓數據無效:', data);
          return;
        }
        
        if (eventListeners.onDrumHit) {
          eventListeners.onDrumHit(data);
        }
      });

      // 接收服務器時間
      socket.on('server-time', (data) => {
        if(!data || typeof data.serverTime !== 'number') {
          console.error('[Socket] 服務器時間數據無效:', data);
          return;
        }
        
        if (timePromiseResolve) {
          timePromiseResolve(data.serverTime);
          timePromiseResolve = null;
        }
      });
    }
  
    // 加入房間
    function joinRoom(roomId) {
      if(!roomId) {
        console.error('[Socket] 房間ID無效');
        return;
      }
      
      currentRoom.id = roomId;
      
      // 發送加入房間請求
      socket.emit('join-room', {
        roomId: roomId,
        userId: currentUser.id
      });
      
      console.log(`[Socket] 正在加入房間: ${roomId}`);
      updateRoomInfo(`房間: ${roomId} (加入中...)`);
    }
  
    // 發送打鼓事件
    function sendDrumHit(drumType) {
        if (!socket || !socket.connected) {
          console.warn('[Socket] 無法發送打鼓事件: 未連接到服務器');
          return false;
        }
        
        if(!drumType) {
          console.error('[Socket] 鼓類型無效');
          return false;
        }
        
        try {
          // 使用延遲管理器校正時間戳
          const timestamp = window.LatencyManager.adjustEventTime(Date.now());
          
          // 發送到服務器
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
  
    // 更新連接狀態顯示
    function updateConnectionStatus(status, isConnected) {
      const statusElement = document.getElementById('connectionStatus');
      if (statusElement) {
        statusElement.textContent = `狀態: ${status}`;
        statusElement.style.backgroundColor = isConnected ? '#2e7d32' : '#c62828';
      }
    }
  
    // 更新房間資訊顯示
    function updateRoomInfo(info) {
      const infoElement = document.getElementById('roomInfo');
      if (infoElement) {
        infoElement.textContent = info;
      }
    }
  
    // 註冊事件監聽器
    function on(eventName, callback) {
      if(!eventName || typeof callback !== 'function') {
        console.error('[Socket] 無效的事件監聽器參數');
        return;
      }
      eventListeners[eventName] = callback;
    }
  
    // 設置當前用戶的鼓類型
    function setDrumType(drumType) {
      if(!drumType) {
        console.error('[Socket] 鼓類型無效');
        return;
      }
      currentUser.drumType = drumType;
    }

    // 請求服務器時間
    function requestServerTime() {
      return new Promise((resolve, reject) => {
        if (!socket || !socket.connected) {
          reject(new Error('[Socket] 未連接到服務器'));
          return;
        }
        
        timePromiseResolve = resolve;
        socket.emit('request-server-time');
        
        // 設置超時以避免永久等待
        setTimeout(() => {
          if (timePromiseResolve) {
            timePromiseResolve = null;
            reject(new Error('[Socket] 時間同步請求超時'));
          }
        }, 3000);
      });
    }
  
    // 暴露公共方法
    return {
        init,
        currentUser,
        currentRoom,
        sendDrumHit,
        on,
        setDrumType,
        requestServerTime   
    };
  
  // 導出模組
  window.SocketManager = SocketManager;
})();