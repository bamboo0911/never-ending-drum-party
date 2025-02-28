const roomManager = require('./rooms');
const timeSync = require('../utils/time-sync');

module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log('新用戶連接:', socket.id);
    
    // Setup time synchronization handler
    timeSync.handleTimeSync(socket);

    // Add user to room with validation
    socket.on('join-room', (data) => {
      try {
        // Validate required data
        if (!data || !data.roomId || !data.userId) {
          return socket.emit('error', { message: '無效的房間加入請求' });
        }
        
        const { roomId, userId } = data;
        console.log(`用戶 ${userId} 加入房間 ${roomId}`);
        
        // Check room capacity before joining
        if (roomManager.isRoomFull(roomId)) {
          return socket.emit('error', { 
            message: '房間已滿', 
            code: 'ROOM_FULL' 
          });
        }
        
        const roomInfo = roomManager.joinRoom(roomId, userId, socket.id);
        
        // Check if position was assigned correctly
        if (!roomInfo.position) {
          return socket.emit('error', { 
            message: '無法分配位置，請稍後再試', 
            code: 'NO_POSITION_AVAILABLE' 
          });
        }
        
        socket.join(roomId);
        socket.userId = userId;
        socket.roomId = roomId;

        // Notify user they've successfully joined
        socket.emit('room-joined', roomInfo);

        // Notify others in the room
        socket.to(roomId).emit('user-joined', {
          userId,
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

    // Handle time synchronization
    socket.on('request-server-time', () => {
      socket.emit('server-time', {
        serverTime: Date.now()
      });
    });

    // Handle drum hit events with validation
    socket.on('drum-hit', (data) => {
      try {
        // Validate user is in a room
        if (!socket.roomId) {
          return socket.emit('error', { 
            message: '未加入房間',
            code: 'NOT_IN_ROOM'
          });
        }
        
        // Validate required data
        if (!data || !data.drumType) {
          return socket.emit('error', { 
            message: '無效的打鼓事件',
            code: 'INVALID_DRUM_EVENT'
          });
        }
        
        console.log(`用戶 ${socket.userId} 敲擊了: ${data.drumType}，時間戳: ${data.timestamp}`);
        
        // Rate limiting to prevent spam (max 20 hits per second)
        if (socket.lastHitTime && Date.now() - socket.lastHitTime < 50) {
          return; // Silently drop events that are too frequent
        }
        socket.lastHitTime = Date.now();
        
        // Broadcast to others in the room
        socket.to(socket.roomId).emit('drum-hit', {
          userId: socket.userId,
          drumType: data.drumType,
          timestamp: data.timestamp || Date.now()
        });
      } catch (error) {
        console.error('打鼓事件錯誤:', error);
        // No need to emit error to client for this event
      }
    });

    // Handle disconnection with cleanup
    socket.on('disconnect', () => {
      try {
        console.log('用戶斷開連接:', socket.id);
        
        if (socket.userId && socket.roomId) {
          roomManager.leaveRoom(socket.roomId, socket.userId);
          
          // Notify others in the room
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