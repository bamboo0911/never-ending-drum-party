// Improved Room Management
const rooms = new Map();

// Available positions (excluding center and bottom-center)
const availablePositions = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-right',
  'bottom-left', 'bottom-right'
];

// Constants
const MAX_USERS_PER_ROOM = 7; // Maximum users per room (matches available positions)
const ROOM_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes

/**
 * Check if a room is at maximum capacity
 * @param {string} roomId - Room identifier
 * @returns {boolean} True if room is full
 */
function isRoomFull(roomId) {
  if (!rooms.has(roomId)) return false;
  
  const room = rooms.get(roomId);
  return room.users.size >= MAX_USERS_PER_ROOM;
}

/**
 * Join a room
 * @param {string} roomId - Room identifier
 * @param {string} userId - User identifier
 * @param {string} socketId - Socket connection ID
 * @returns {Object} Room info including position and users
 */
function joinRoom(roomId, userId, socketId) {
  // Create room if it doesn't exist
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
  
  // Update room activity time
  room.lastActivity = Date.now();
  
  // If user is already in room, update their socket ID
  if (room.users.has(userId)) {
    const userInfo = room.users.get(userId);
    userInfo.socketId = socketId;
    return {
      position: userInfo.position,
      users: Array.from(room.users.values())
    };
  }
  
  // Assign position
  const position = assignGridPosition(room);
  
  // Store user info
  if (position) {
    room.users.set(userId, {
      id: userId,
      socketId,
      position,
      joinedAt: Date.now()
    });
    
    room.gridPositions.set(position, userId);
  }
  
  return {
    position,
    users: Array.from(room.users.values())
  };
}

/**
 * Leave a room
 * @param {string} roomId - Room identifier
 * @param {string} userId - User identifier
 * @returns {boolean} Success status
 */
function leaveRoom(roomId, userId) {
  if (!rooms.has(roomId)) return false;
  
  const room = rooms.get(roomId);
  
  // Find and free up the user's position
  const user = room.users.get(userId);
  if (user && user.position) {
    room.gridPositions.delete(user.position);
  }
  
  // Remove user
  room.users.delete(userId);
  room.lastActivity = Date.now();
  
  // Delete room if empty
  if (room.users.size === 0) {
    rooms.delete(roomId);
  }
  
  return true;
}

/**
 * Assign a grid position
 * @param {Object} room - Room object
 * @returns {string|null} Assigned position or null if none available
 */
function assignGridPosition(room) {
  // Find unused positions
  const usedPositions = new Set();
  
  // Get all used positions
  for (const [position, userId] of room.gridPositions.entries()) {
    usedPositions.add(position);
  }
  
  // Filter to get available positions
  const remainingPositions = availablePositions.filter(pos => !usedPositions.has(pos));
  
  // Assign first available position if any
  if (remainingPositions.length > 0) {
    return remainingPositions[0];
  }
  
  return null; // No available positions
}

/**
 * Get all users in a room
 * @param {string} roomId - Room identifier
 * @returns {Array} Array of user objects
 */
function getRoomUsers(roomId) {
  if (!rooms.has(roomId)) return [];
  
  const room = rooms.get(roomId);
  return Array.from(room.users.values());
}

/**
 * Get information about a room
 * @param {string} roomId - Room identifier
 * @returns {Object|null} Room information or null if not found
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
 * Clean up inactive rooms (no activity for over 1 hour)
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

// Run cleanup every 30 minutes
setInterval(cleanupInactiveRooms, ROOM_CLEANUP_INTERVAL);

// Get room statistics
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