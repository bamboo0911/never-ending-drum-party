const roomManager = require('./rooms');
const timeSync = require('../utils/time-sync');

module.exports = function(io) {
  // 为每个房间设置定期同步
  const roomSyncIntervals = new Map();
  
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
        
        // 傳送成功加入房間通知，包含房間中所有用戶資訊
        socket.emit('room-joined', {
          roomId,
          position: roomInfo.position,
          users: roomInfo.users,
          isHost: userId === roomInfo.hostId,
          isPlaying: roomInfo.isPlaying
        });
        
        // 通知房間中其他用戶
        socket.to(roomId).emit('user-joined', {
          userId,
          name,
          drumType,
          position: roomInfo.position
        });
        
        // 在新用户加入房间后，进行一次强制全室同步
        setTimeout(() => {
          roomManager.syncRoomUsers(roomId);
        }, 1000);
        
        // 为房间设置定期同步（如果尚未设置）
        if (!roomSyncIntervals.has(roomId)) {
          console.log(`為房間 ${roomId} 設置定期同步`);
          const intervalId = setInterval(() => {
            // 只在房间有人时才同步
            const roomState = roomManager.getRoomInfo(roomId);
            if (roomState && roomState.userCount > 0) {
              roomManager.syncRoomUsers(roomId);
            } else {
              // 如果房间空了，清除同步间隔
              clearInterval(intervalId);
              roomSyncIntervals.delete(roomId);
              console.log(`房間 ${roomId} 已空，取消定期同步`);
            }
          }, 20000); // 每20秒同步一次
          
          roomSyncIntervals.set(roomId, intervalId);
        }
      } catch (error) {
        console.error('加入房間錯誤:', error);
        socket.emit('error', { 
          message: '加入房間時發生錯誤',
          code: 'JOIN_ERROR'
        });
      }
    });

    // 處理時間同步請求
    socket.on('request-server-time', (data) => {
      socket.emit('server-time', {
        serverTime: Date.now(),
        requestId: data?.requestId
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
    
    // 處理請求房間成員列表
    socket.on('request-room-users', () => {
      if (!socket.roomId) {
        return socket.emit('error', { 
          message: '未加入房間',
          code: 'NOT_IN_ROOM'
        });
      }
      
      const users = roomManager.getRoomUsers(socket.roomId);
      socket.emit('room-users', { users });
      
      // 顺便触发一次全房间同步
      roomManager.syncRoomUsers(socket.roomId);
    });
    
    // 處理更換樂器事件
    socket.on('change-instrument', (data) => {
      if (!socket.roomId || !socket.userId) {
        return socket.emit('error', { 
          message: '未加入房間',
          code: 'NOT_IN_ROOM'
        });
      }
      
      if (!data || !data.drumType) {
        return socket.emit('error', { 
          message: '無效的樂器類型',
          code: 'INVALID_INSTRUMENT'
        });
      }
      
      // 获取当前房间和用户
      const room = roomManager.getRoomUsers(socket.roomId);
      if (!room) return;
      
      // 更新用户的乐器类型
      const roomState = roomManager.getRoomState(socket.roomId);
      if (roomState && roomState.users) {
        const user = roomState.users.get(socket.userId);
        if (user) {
          user.drumType = data.drumType;
          
          // 通知房间中的所有人有用户更换了乐器
          io.to(socket.roomId).emit('instrument-changed', {
            userId: socket.userId,
            drumType: data.drumType
          });
          
          // 同步一次房间状态
          roomManager.syncRoomUsers(socket.roomId);
        }
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
          
          // 在用户离开后，进行一次强制全室同步
          setTimeout(() => {
            roomManager.syncRoomUsers(socket.roomId);
          }, 1000);
        }
      } catch (error) {
        console.error('斷開連接處理錯誤:', error);
      }
    });
  });
};