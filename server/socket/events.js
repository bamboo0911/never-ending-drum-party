const roomManager = require('./rooms');

module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log('新用戶連接:', socket.id);

    // 加入房間
    socket.on('join-room', (data) => {
      const { roomId, userId } = data;
      console.log(`用戶 ${userId} 加入房間 ${roomId}`);
      
      const roomInfo = roomManager.joinRoom(roomId, userId, socket.id);
      
      socket.join(roomId);
      socket.userId = userId;
      socket.roomId = roomId;

      // 通知用戶已成功加入
      socket.emit('room-joined', roomInfo);

      // 通知房間內其他用戶
      socket.to(roomId).emit('user-joined', {
        userId,
        position: roomInfo.position
      });
    });

    // 打鼓事件
    socket.on('drum-hit', (data) => {
      if (!socket.roomId) return;
      
      console.log(`用戶 ${socket.userId} 敲擊了: ${data.drumType}`);
      
      // 廣播給同一房間的其他用戶
      socket.to(socket.roomId).emit('drum-hit', {
        userId: socket.userId,
        drumType: data.drumType,
        timestamp: data.timestamp
      });
    });

    // 斷開連接
    socket.on('disconnect', () => {
      console.log('用戶斷開連接:', socket.id);
      
      if (socket.userId && socket.roomId) {
        roomManager.leaveRoom(socket.roomId, socket.userId);
        
        // 通知房間內其他用戶
        socket.to(socket.roomId).emit('user-left', {
          userId: socket.userId
        });
      }
    });
  });
};