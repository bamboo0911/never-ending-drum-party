// 主程序
(function() {
    // 等待 DOM 加載完成
    document.addEventListener('DOMContentLoaded', initApp);
    
    // 初始化應用
    async function initApp() {
      console.log('初始化應用...');
      
      try {
        // 初始化用戶界面
        window.UIManager.init();
        
        // 初始化音頻
        await window.AudioManager.init();
        
        // 初始化 Socket 連接
        await window.SocketManager.init();
        
        // 設置事件處理
        setupEventHandlers();
        
        // 設置鍵盤事件
        setupKeyboardEvents();
        
        console.log('應用初始化完成');
      } catch (error) {
        console.error('應用初始化失敗:', error);
        document.getElementById('connectionStatus').textContent = '初始化失敗，請重新整理頁面';
      }
    }
    
    // 設置事件處理
    function setupEventHandlers() {
      // 處理房間加入事件
      window.SocketManager.on('onRoomJoined', (data) => {
        window.UIManager.updateUserCells(data.users);
      });
      
      // 處理用戶加入事件
      window.SocketManager.on('onUserJoined', (data) => {
        window.UIManager.addUserToCell(data.userId, data.position);
      });
      
      // 處理用戶離開事件
      window.SocketManager.on('onUserLeft', (data) => {
        window.UIManager.removeUserFromCell(data.userId);
      });
      
      // 處理打鼓事件
      window.SocketManager.on('onDrumHit', (data) => {
        // 播放音效
        window.AudioManager.playSound(data.drumType);
        
        // 高亮格子
        window.UIManager.highlightUserCell(data.userId);
      });
    }
    
    // 設置鍵盤事件
    function setupKeyboardEvents() {
      document.addEventListener('keydown', (e) => {
        // 避免按住鍵時重複觸發
        if (e.repeat) return;
        
        const key = e.key.toLowerCase();
        let drumType = null;
        
        // 鍵盤映射
        switch (key) {
          case 'q':
            drumType = 'kick';
            break;
          case 'w':
            drumType = 'snare';
            break;
          case 'e':
            drumType = 'hihat';
            break;
          case 'r':
            drumType = 'tom';
            break;
          case 't':
            drumType = 'crash';
            break;
        }
        
        if (drumType) {
          // 本地播放音效
          window.AudioManager.playSound(drumType);
          
          // 高亮自己的格子
          window.UIManager.highlightUserCell(window.SocketManager.currentUser.id);
          
          // 發送到服務器
          window.SocketManager.sendDrumHit(drumType);
        }
      });
    }
  })();