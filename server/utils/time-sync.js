/**
 * Time Synchronization Utility for Server
 * Helps handle time synchronization requests and manage client time offsets
 */

// Store client time offsets for potential future features
const clientTimeOffsets = new Map();

/**
 * Handle time synchronization request from client
 * @param {Object} socket - The socket connection
 * @param {Object} io - Socket.io instance
 */
function handleTimeSync(socket) {
  socket.on('request-server-time', (data) => {
    // Send server timestamp immediately
    socket.emit('server-time', {
      serverTime: Date.now(),
      // Include request ID if client sent one for correlation
      requestId: data?.requestId
    });
  });
}

/**
 * Store client time offset data
 * @param {string} clientId - Client identifier
 * @param {number} offset - Time offset in milliseconds
 */
function storeClientOffset(clientId, offset) {
  clientTimeOffsets.set(clientId, {
    offset,
    lastUpdated: Date.now()
  });
}

/**
 * Get statistics about client time offsets
 * Useful for monitoring network conditions
 */
function getOffsetStatistics() {
  if (clientTimeOffsets.size === 0) return null;
  
  const offsets = Array.from(clientTimeOffsets.values()).map(data => data.offset);
  const average = offsets.reduce((sum, val) => sum + val, 0) / offsets.length;
  const min = Math.min(...offsets);
  const max = Math.max(...offsets);
  
  return {
    averageOffset: average,
    minOffset: min,
    maxOffset: max,
    clientCount: clientTimeOffsets.size
  };
}

/**
 * Clean up stale client data (older than 1 hour)
 */
function cleanupStaleClients() {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  
  for (const [clientId, data] of clientTimeOffsets.entries()) {
    if (now - data.lastUpdated > ONE_HOUR) {
      clientTimeOffsets.delete(clientId);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupStaleClients, 60 * 60 * 1000);

module.exports = {
  handleTimeSync,
  storeClientOffset,
  getOffsetStatistics
};