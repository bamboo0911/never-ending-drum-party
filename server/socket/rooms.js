// Improved Room Management with better user synchronization
const rooms = new Map();

// 可用位置（僅供非本地玩家使用，因為每位用戶的畫面中央固定空白，且中間下方為自身）
const availablePositions = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-right',
  'bottom-left', 'bottom-right'
];

// 注意: 不要使用 'bottom-center'，因為這個位置保留給每個本地用戶

// 更新上限：總玩家數上限 8 人（代表其他玩家上限 7 人）
const MAX_USERS_PER_ROOM = 8;
const ROOM_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 分鐘

// This will store the Socket.io instance
let socketIo = null;

/**
 * 初始化房間管理器，接收 Socket.io 實例
 * @param {Object} io - Socket.io 實例
 */
function initialize(io) {
  socketIo = io;
  console.log('房間管理器已初始化');
}

/**
 * 建立新房間
 * @param {string} roomId - 房間識別碼
 * @returns {Object} 新建立的房間物件
 */
function createRoom(roomId) {
  const room = {
    id: roomId,
    users: new Map(),
    gridPositions: new Map(),
    hostId: null,         // 新增: 房主ID
    isPlaying: false,     // 新增: 鼓圈是否正在進行
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
  
  rooms.set(roomId, room);
  console.log(`新房間已創建: ${roomId}`);
  return room;
}

/**
 * 指派房主
 * @param {string} roomId - 房間識別碼
 * @returns {string|null} 新房主ID或null
 */
function assignHost(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  
  // 如果已有房主且房主仍在房間中，則保持不變
  if (room.hostId && room.users.has(room.hostId)) {
    return room.hostId;
  }
  
  // 若無房主或房主已離開，選擇新房主
  const participantIds = Array.from(room.users.keys());
  if (participantIds.length === 0) {
    room.hostId = null;
    return null;
  }
  
  // 隨機選擇一名玩家作為新房主
  const newHostId = participantIds[Math.floor(Math.random() * participantIds.length)];
  room.hostId = newHostId;
  
  // 通知房間內所有人新房主的變更 - 使用初始化時獲得的 socketIo
  if (socketIo) {
    socketIo.to(roomId).emit('host-changed', {
      hostId: newHostId
    });
    console.log(`通知房間 ${roomId} 新房主為: ${newHostId}`);
  } else {
    console.warn(`無法發送 host-changed 事件，Socket.io 未初始化`);
  }
  
  console.log(`房間 ${roomId} 的新房主為: ${newHostId}`);
  return newHostId;
}

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
 * 為用戶分配 grid 位置 - 確保不使用 'bottom-center'
 * @param {Object} room - 房間物件
 * @returns {string|null} 分配到的位置，若無則回傳 null
 */
function assignGridPosition(room) {
  const usedPositions = new Set();
  for (const [position, userId] of room.gridPositions.entries()) {
    usedPositions.add(position);
  }
  
  // 確保只使用有效位置 - 不使用 'bottom-center'
  const remainingPositions = availablePositions.filter(pos => !usedPositions.has(pos));
  
  if (remainingPositions.length > 0) {
    // 随机选择一个位置，而不是总是第一个，这样可以更加分散
    const randomIndex = Math.floor(Math.random() * remainingPositions.length);
    const position = remainingPositions[randomIndex];
    
    // 確認不是 'bottom-center'
    if (position === 'bottom-center') {
      console.error(`嘗試分配 bottom-center 位置，這是一個錯誤！選擇其他位置`);
      // 如果還有其他位置，選擇不同的位置
      if (remainingPositions.length > 1) {
        return remainingPositions[(randomIndex + 1) % remainingPositions.length];
      }
    }
    
    return position;
  }
  
  return null;
}

/**
 * 加入房間 - 現在確保不使用 'bottom-center' 位置
 * @param {string} roomId - 房間識別碼
 * @param {string} userId - 用戶識別碼
 * @param {string} socketId - Socket 連線 ID
 * @param {string} name - 玩家名稱
 * @param {string} drumType - 樂器類型
 * @returns {Object} 包含該用戶的 position 及房間中所有用戶資訊
 */
function joinRoom(roomId, userId, socketId, name, drumType) {
  console.log(`處理用戶 ${userId} (${name}) 加入房間 ${roomId} 的請求`);
  
  // 如果房間不存在則建立
  let room = rooms.get(roomId);
  if (!room) {
    room = createRoom(roomId);
  }

  // 更新房間活動時間
  room.lastActivity = Date.now();
  
  // 如果用戶已存在於房間中，更新其 socketId
  if (room.users.has(userId)) {
    console.log(`用戶 ${userId} 已在房間中，更新 socketId`);
    const userInfo = room.users.get(userId);
    userInfo.socketId = socketId;
    return {
      position: userInfo.position,
      users: getRoomUsers(roomId),
      hostId: room.hostId,
      isPlaying: room.isPlaying
    };
  }
  
  // 分配位置 - 不使用 'bottom-center'
  let position = assignGridPosition(room);
  console.log(`為用戶 ${userId} 分配位置: ${position || '無可用位置'}`);
  
  // 儲存用戶資訊
  const userInfo = {
    id: userId,
    socketId,
    position,
    joinedAt: Date.now(),
    name,
    drumType
  };
  
  room.users.set(userId, userInfo);
  console.log(`用戶 ${userId} 已添加到房間 ${roomId}`);
  
  if (position !== null) {
    room.gridPositions.set(position, userId);
  }

  // 檢查房間是否需要指派房主 - 如果是第一个用户，直接设为房主
  if (room.users.size === 1 || !room.hostId) {
    room.hostId = userId;
    
    // 使用 socketIo 通知用戶成為房主
    if (socketIo) {
      socketIo.to(socketId).emit('host-assigned', { isHost: true });
      console.log(`用戶 ${userId} 成為房間 ${roomId} 的房主，已發送通知`);
    } else {
      console.warn(`無法發送 host-assigned 事件，Socket.io 未初始化`);
    }
    
    console.log(`用戶 ${userId} 作為首位加入者成為房間 ${roomId} 的房主`);
  } else {
    // 通知用戶當前房主狀態
    if (socketIo) {
      socketIo.to(socketId).emit('host-status', { 
        hostId: room.hostId,
        isHost: userId === room.hostId,
        isPlaying: room.isPlaying
      });
      console.log(`已通知用戶 ${userId} 當前房主是 ${room.hostId}`);
    } else {
      console.warn(`無法發送 host-status 事件，Socket.io 未初始化`);
    }
  }
  
  // 获取完整的用户列表（包含自己）
  const allUsers = getRoomUsers(roomId);
  console.log(`返回房間 ${roomId} 的所有用戶 (${allUsers.length} 人)`);
  
  return {
    position,
    users: allUsers,
    hostId: room.hostId,
    isPlaying: room.isPlaying
  };
}

/**
 * 離開房間
 * @param {string} roomId - 房間識別碼
 * @param {string} userId - 用戶識別碼
 * @returns {boolean} 回傳操作是否成功
 */
function leaveRoom(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) return false;
  
  console.log(`用戶 ${userId} 離開房間 ${roomId}`);
  
  // 釋放該用戶所佔位置
  const user = room.users.get(userId);
  if (user && user.position) {
    room.gridPositions.delete(user.position);
    console.log(`釋放位置: ${user.position}`);
  }
  
  // 移除用戶
  room.users.delete(userId);
  room.lastActivity = Date.now();
  
  // 檢查離開的是否為房主
  if (userId === room.hostId) {
    console.log(`房主 ${userId} 離開，需要指派新房主`);
    assignHost(roomId);
  }
  
  // 若房間內無用戶則清除房間
  if (room.users.size === 0) {
    console.log(`房間 ${roomId} 無用戶，將被清除`);
    rooms.delete(roomId);
  }
  
  return true;
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
    lastActivity: room.lastActivity,
    hostId: room.hostId,
    isPlaying: room.isPlaying
  };
}

/**
 * 取得房間狀態
 * @param {string} roomId - 房間識別碼
 * @returns {Object|null} 房間狀態或null
 */
function getRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  
  return {
    isPlaying: room.isPlaying,
    hostId: room.hostId,
    users: room.users  // 添加用户列表引用以便外部代码可以修改
  };
}

/**
 * 更新房間狀態
 * @param {string} roomId - 房間識別碼
 * @param {Object} updates - 要更新的屬性
 * @returns {boolean} 更新是否成功
 */
function updateRoomState(roomId, updates) {
  const room = rooms.get(roomId);
  if (!room) return false;
  
  Object.assign(room, updates);
  room.lastActivity = Date.now();
  
  return true;
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

/**
 * 取得房間統計資訊
 * @returns {Object} 房間統計資訊
 */
function getRoomStats() {
  return {
    totalRooms: rooms.size,
    rooms: Array.from(rooms.values()).map(room => ({
      id: room.id,
      userCount: room.users.size,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
      hostId: room.hostId,
      isPlaying: room.isPlaying
    }))
  };
}

/**
 * 強制同步房間內所有用戶的資訊到客戶端
 * @param {string} roomId - 房間識別碼
 */
function syncRoomUsers(roomId) {
  if (!socketIo || !rooms.has(roomId)) return false;
  
  const users = getRoomUsers(roomId);
  socketIo.to(roomId).emit('room-users-sync', { 
    users,
    hostId: rooms.get(roomId).hostId
  });
  
  console.log(`已強制同步房間 ${roomId} 的用戶列表 (${users.length} 人)`);
  return true;
}

module.exports = {
  initialize,
  joinRoom,
  leaveRoom,
  getRoomUsers,
  getRoomInfo,
  isRoomFull,
  getRoomStats,
  assignHost,
  getRoomState,
  updateRoomState,
  syncRoomUsers
};