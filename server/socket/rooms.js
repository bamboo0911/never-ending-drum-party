// 儲存房間資訊
const rooms = new Map();

// 可用位置（排除中心和中下）
const availablePositions = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-right',
  'bottom-left', 'bottom-right'
];

// 加入房間
function joinRoom(roomId, userId, socketId) {
  // 如果房間不存在則創建
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      users: new Map(),
      gridPositions: new Map()
    });
  }

  const room = rooms.get(roomId);
  
  // 分配位置
  const position = assignGridPosition(room);
  
  // 儲存用戶資訊
  room.users.set(userId, {
    id: userId,
    socketId,
    position
  });
  
  room.gridPositions.set(userId, position);
  
  return {
    position,
    users: Array.from(room.users.values())
  };
}

// 離開房間
function leaveRoom(roomId, userId) {
  if (!rooms.has(roomId)) return false;
  
  const room = rooms.get(roomId);
  room.users.delete(userId);
  room.gridPositions.delete(userId);
  
  // 如果房間空了，刪除房間
  if (room.users.size === 0) {
    rooms.delete(roomId);
  }
  
  return true;
}

// 分配格子位置
function assignGridPosition(room) {
  // 找出未被佔用的位置
  const usedPositions = Array.from(room.gridPositions.values());
  const remainingPositions = availablePositions
    .filter(pos => !usedPositions.includes(pos));
  
  // 如果有位置，分配第一個可用的
  if (remainingPositions.length > 0) {
    return remainingPositions[0];
  }
  
  return null; // 沒有可用位置
}

// 取得房間內所有用戶
function getRoomUsers(roomId) {
  if (!rooms.has(roomId)) return [];
  
  const room = rooms.get(roomId);
  return Array.from(room.users.values());
}

module.exports = {
  joinRoom,
  leaveRoom,
  getRoomUsers
};