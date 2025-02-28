// Improved Room Management
const rooms = new Map();

// 可用位置（僅供非本地玩家使用，因為每位用戶的畫面中央固定空白，且中間下方為自身）
const availablePositions = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-right',
  'bottom-left', 'bottom-right'
];

// 更新上限：總玩家數上限 8 人（代表其他玩家上限 7 人）
const MAX_USERS_PER_ROOM = 8;
const ROOM_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 分鐘

/**
 * 檢查房間是否已滿
 * @param {string} roomId - 房間識別碼
 * @returns {boolean} 若房間已滿則回傳 true
 */
function isRoomFull(roomId) {
  if (!rooms.has(roomId)) return false;
  
  const room = rooms.get(roomId);
  return room.users.size >= MAX_USERS_PER_ROOM;
}

/**
 * 加入房間
 * @param {string} roomId - 房間識別碼
 * @param {string} userId - 用戶識別碼
 * @param {string} socketId - Socket 連線 ID
 * @param {string} name - 玩家名稱
 * @param {string} drumType - 樂器類型
 * @returns {Object} 包含該用戶的 position 及房間中所有用戶資訊
 */
function joinRoom(roomId, userId, socketId, name, drumType) {
  // 如果房間不存在則建立
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      users: new Map(),
      gridPositions: new Map(),
      createdAt: Date.now(),
      lastActivity: Date.now()
    });
  }

  const room = rooms.get(roomId);
  
  // 更新房間活動時間
  room.lastActivity = Date.now();
  
  // 如果用戶已存在於房間中，更新其 socketId
  if (room.users.has(userId)) {
    const userInfo = room.users.get(userId);
    userInfo.socketId = socketId;
    return {
      position: userInfo.position,
      users: Array.from(room.users.values())
    };
  }
  
  let position;
  if (room.users.size === 0) {
    // 第一位用戶：不分配 grid position，由客戶端自行置於中下方
    position = null;
  } else {
    // 為新進用戶分配一個可用位置
    position = assignGridPosition(room);
  }
  
  // 儲存用戶資訊，包含 name 與 drumType
  room.users.set(userId, {
    id: userId,
    socketId,
    position,
    joinedAt: Date.now(),
    name,        // 新增玩家名稱
    drumType     // 新增樂器類型
  });
  
  if (position !== null) {
    room.gridPositions.set(position, userId);
  }
  
  return {
    position,
    users: Array.from(room.users.values())
  };
}

/**
 * 離開房間
 * @param {string} roomId - 房間識別碼
 * @param {string} userId - 用戶識別碼
 * @returns {boolean} 回傳操作是否成功
 */
function leaveRoom(roomId, userId) {
  if (!rooms.has(roomId)) return false;
  
  const room = rooms.get(roomId);
  
  // 釋放該用戶所佔位置
  const user = room.users.get(userId);
  if (user && user.position) {
    room.gridPositions.delete(user.position);
  }
  
  // 移除用戶
  room.users.delete(userId);
  room.lastActivity = Date.now();
  
  // 若房間內無用戶則清除房間
  if (room.users.size === 0) {
    rooms.delete(roomId);
  }
  
  return true;
}

/**
 * 為用戶分配 grid 位置
 * @param {Object} room - 房間物件
 * @returns {string|null} 分配到的位置，若無則回傳 null
 */
function assignGridPosition(room) {
  // 取得已使用的位置
  const usedPositions = new Set();
  for (const [position, userId] of room.gridPositions.entries()) {
    usedPositions.add(position);
  }
  
  // 篩選可用位置
  const remainingPositions = availablePositions.filter(pos => !usedPositions.has(pos));
  
  // 回傳第一個可用位置
  if (remainingPositions.length > 0) {
    return remainingPositions[0];
  }
  
  return null; // 若無可用位置
}

/**
 * 取得房間內所有用戶
 * @param {string} roomId - 房間識別碼
 * @returns {Array} 用戶物件陣列
 */
function getRoomUsers(roomId) {
  if (!rooms.has(roomId)) return [];
  
  const room = rooms.get(roomId);
  return Array.from(room.users.values());
}

/**
 * 取得房間資訊
 * @param {string} roomId - 房間識別碼
 * @returns {Object|null} 房間資訊或若未找到則回傳 null
 */
function getRoomInfo(roomId) {
  if (!rooms.has(roomId)) return null;
  
  const room = rooms.get(roomId);
  return {
    id: room.id,
    userCount: room.users.size,
    isFull: room.users.size >= MAX_USERS_PER_ROOM,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity
  };
}

/**
 * 清理超過 1 小時無活動的房間
 */
function cleanupInactiveRooms() {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > ONE_HOUR) {
      console.log(`清理閒置房間: ${roomId}`);
      rooms.delete(roomId);
    }
  }
}

// 每 30 分鐘清理一次
setInterval(cleanupInactiveRooms, ROOM_CLEANUP_INTERVAL);

// 取得房間統計資訊
function getRoomStats() {
  return {
    totalRooms: rooms.size,
    rooms: Array.from(rooms.values()).map(room => ({
      id: room.id,
      userCount: room.users.size,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity
    }))
  };
}

module.exports = {
  joinRoom,
  leaveRoom,
  getRoomUsers,
  getRoomInfo,
  isRoomFull,
  getRoomStats
};