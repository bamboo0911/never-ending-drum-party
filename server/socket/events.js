const roomManager = require('./rooms');
const timeSync = require('../utils/time-sync');

module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log('新用戶連接:', socket.id);
    
    // 設定時間同步處理
    timeSync.handleTimeSync(socket);

    // 處理加入房間事件
    socket.on('join-room', (data) => {
      try {
        // 現在除了 roomId 與 userId，也必須包含 name 與 drumType
        if (!data || !data.roomId || !data.userId || !data.name || !data.drumType) {
          return socket.emit('error', { message: '無效的房間加入請求' });
        }
        
        const { roomId, userId, name, drumType } = data;
        console.log(`用戶 ${userId} (${name}) 加入房間 ${roomId}，使用樂器: ${drumType}`);
        
        // 檢查房間容量
        if (roomManager.isRoomFull(roomId)) {
          return socket.emit('error', { 
            message: '房間已滿', 
            code: 'ROOM_FULL' 
          });
        }
        
        // 傳入 name 與 drumType 至 joinRoom
        const roomInfo = roomManager.joinRoom(roomId, userId, socket.id, name, drumType);
        
        // 若無法分配位置（理論上僅發生於非第一位用戶），則回傳錯誤
        if (roomInfo.position === undefined) {
          return socket.emit('error', { 
            message: '無法分配位置，請稍後再試', 
            code: 'NO_POSITION_AVAILABLE' 
          });
        }
        
        socket.join(roomId);
        socket.userId = userId;
        socket.roomId = roomId;
        
        // 傳送成功加入房間通知，包含房間中所有用戶資訊（其中每個用戶物件內就有 name 與 drumType）
        socket.emit('room-joined', roomInfo);
        
        // 通知房間中其他用戶
        socket.to(roomId).emit('user-joined', {
          userId,
          name,
          drumType,
          position: roomInfo.position
        });
      } catch (error) {
        console.error('加入房間錯誤:', error);
        socket.emit('error', { 
          message: '加入房間時發生錯誤',
          code: 'JOIN_ERROR'
        });
      }
    });

    // 處理時間同步請求
    socket.on('request-server-time', () => {
      socket.emit('server-time', {
        serverTime: Date.now()
      });
    });

    // 處理打鼓事件
    socket.on('drum-hit', (data) => {
      try {
        // 檢查用戶是否已加入房間
        if (!socket.roomId) {
          return socket.emit('error', { 
            message: '未加入房間',
            code: 'NOT_IN_ROOM'
          });
        }
        
        // 驗證必要資料
        if (!data || !data.drumType) {
          return socket.emit('error', { 
            message: '無效的打鼓事件',
            code: 'INVALID_DRUM_EVENT'
          });
        }
        
        console.log(`用戶 ${socket.userId} 敲擊了: ${data.drumType}，時間戳: ${data.timestamp}`);
        
        // Rate limiting：防止過於頻繁，限制每秒最多 20 次
        if (socket.lastHitTime && Date.now() - socket.lastHitTime < 50) {
          return; // 若過於頻繁，則忽略此次事件
        }
        socket.lastHitTime = Date.now();
        
        // 廣播打鼓事件給房間中其它用戶
        socket.to(socket.roomId).emit('drum-hit', {
          userId: socket.userId,
          drumType: data.drumType,
          timestamp: data.timestamp || Date.now()
        });
      } catch (error) {
        console.error('打鼓事件錯誤:', error);
        // 此事件發生錯誤時不需通知客戶端
      }
    });

    // 處理用戶斷線與清除
    socket.on('disconnect', () => {
      try {
        console.log('用戶斷開連接:', socket.id);
        
        if (socket.userId && socket.roomId) {
          roomManager.leaveRoom(socket.roomId, socket.userId);
          
          // 通知房間中其它用戶有用戶離開
          socket.to(socket.roomId).emit('user-left', {
            userId: socket.userId
          });
        }
      } catch (error) {
        console.error('斷開連接處理錯誤:', error);
      }
    });
  });
};