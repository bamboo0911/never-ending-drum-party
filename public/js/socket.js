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
  
    // 初始化 Socket.io 連接
    function init() {
      return new Promise((resolve, reject) => {
        try {
          // 創建連接
          socket = io();
          
          // 連接建立成功
          socket.on('connect', () => {
            console.log('已連接到服務器');
            updateConnectionStatus('已連接', true);
            
            // 加入默認房間
            joinRoom(currentRoom.id);
            resolve(true);
          });
          
          // 連接出錯
          socket.on('connect_error', (error) => {
            console.error('連接錯誤:', error);
            updateConnectionStatus('連接失敗', false);
            reject(error);
          });
          
          // 斷開連接
          socket.on('disconnect', () => {
            console.log('與服務器斷開連接');
            updateConnectionStatus('已斷開', false);
          });
          
          // 設置事件監聽
          setupEventListeners();
        } catch (error) {
          console.error('初始化 Socket.io 失敗:', error);
          updateConnectionStatus('初始化失敗', false);
          reject(error);
        }
      });
    }
  
    // 設置事件監聽
    function setupEventListeners() {
      // 成功加入房間
      socket.on('room-joined', (data) => {
        console.log('已加入房間', data);
        updateRoomInfo(`房間: ${currentRoom.id} (${data.users.length} 人在線)`);
        
        // 更新用戶列表
        if (eventListeners.onRoomJoined) {
          eventListeners.onRoomJoined(data);
        }
      });
      
      // 其他用戶加入
      socket.on('user-joined', (data) => {
        console.log('用戶加入:', data);
        
        if (eventListeners.onUserJoined) {
          eventListeners.onUserJoined(data);
        }
      });
      
      // 用戶離開
      socket.on('user-left', (data) => {
        console.log('用戶離開:', data);
        
        if (eventListeners.onUserLeft) {
          eventListeners.onUserLeft(data);
        }
      });
      
      // 接收打鼓事件
      socket.on('drum-hit', (data) => {
        console.log('收到打鼓:', data);
        
        if (eventListeners.onDrumHit) {
          eventListeners.onDrumHit(data);
        }
      });
    }
  
    // 加入房間
    function joinRoom(roomId) {
      currentRoom.id = roomId;
      
      // 發送加入房間請求
      socket.emit('join-room', {
        roomId: roomId,
        userId: currentUser.id
      });
      
      console.log(`正在加入房間: ${roomId}`);
      updateRoomInfo(`房間: ${roomId} (加入中...)`);
    }
  
    // 發送打鼓事件
    function sendDrumHit(drumType) {
      if (!socket || !socket.connected) {
        console.warn('無法發送打鼓事件: 未連接到服務器');
        return false;
      }
      
      // 發送到服務器
      socket.emit('drum-hit', {
        drumType: drumType,
        timestamp: Date.now()
      });
      
      return true;
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
      eventListeners[eventName] = callback;
    }
  
    // 設置當前用戶的鼓類型
    function setDrumType(drumType) {
      currentUser.drumType = drumType;
    }
  
    // 暴露公共方法
    return {
      init,
      currentUser,
      currentRoom,
      sendDrumHit,
      on,
      setDrumType
    };
  })();
  
  // 導出模組
  window.SocketManager = SocketManager;