const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const roomManager = require('./socket/rooms');
const socketEvents = require('./socket/events');
const hostEvents = require('./socket/host-events');

// 建立 Express 應用和 HTTP 服務器
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// 提供靜態文件
app.use(express.static(path.join(__dirname, '../public')));

// 路由設定
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/config.html'));
});

// 初始化房間管理器，傳入 io 實例
roomManager.initialize(io);

// 設定 Socket.io 事件處理
socketEvents(io);
hostEvents(io);

// 啟動服務器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Never Ending Drum Party 服務器運行在 http://localhost:${PORT}`);
});