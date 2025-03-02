const roomManager = require('./rooms');

module.exports = function(io) {
  io.on('connection', (socket) => {
    // 處理鼓圈控制請求 (開始/停止)
    socket.on('control-drum-circle', (data) => {
      const { roomId, action } = data;
      const userId = socket.userId;
      
      // 取得房間
      const roomState = roomManager.getRoomState(roomId);
      if (!roomState) {
        return socket.emit('error', { message: '找不到指定房間' });
      }
      
      // 驗證是否為房主
      if (roomState.hostId !== userId) {
        return socket.emit('error', { message: '只有房主可以控制鼓圈' });
      }
      
      // 根據動作執行不同邏輯
      switch (action) {
        case 'start':
          // 如果已經在進行中則忽略
          if (roomState.isPlaying) {
            return socket.emit('error', { message: '鼓圈已經在進行中' });
          }
          
          // 更新房間狀態
          roomManager.updateRoomState(roomId, { isPlaying: true });
          
          // 發送倒數信號
          io.to(roomId).emit('conductor-signal', {
            type: 'countdown',
            timestamp: Date.now(),
            roomId,
            data: {
              bpm: 90,
              count: 4,
              intervalMs: 666, // 60000 / 90
              purpose: 'start'
            }
          });
          
          // 在倒數結束後發送開始信號
          setTimeout(() => {
            io.to(roomId).emit('circle-started', {
              startTime: Date.now() + 100 // 略微延遲確保同步
            });
          }, 4 * 666); // 4拍的時間
          
          break;
          
        case 'stop':
          // 如果不在進行中則忽略
          if (!roomState.isPlaying) {
            return socket.emit('error', { message: '鼓圈尚未開始' });
          }
          
          // 更新房間狀態
          roomManager.updateRoomState(roomId, { isPlaying: false });
          
          // 發送停止信號
          io.to(roomId).emit('circle-stopped');
          
          break;
          
        default:
          socket.emit('error', { message: '未知的控制動作' });
      }
    });
    
    // 請求當前房主狀態
    socket.on('request-host-status', (data) => {
      const { roomId } = data;
      const roomState = roomManager.getRoomState(roomId);
      
      if (!roomState) {
        return socket.emit('error', { message: '找不到指定房間' });
      }
      
      socket.emit('host-status', {
        hostId: roomState.hostId,
        isHost: socket.userId === roomState.hostId,
        isPlaying: roomState.isPlaying
      });
    });
  });
};