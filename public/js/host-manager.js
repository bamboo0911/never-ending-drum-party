const HostManager = (function() {
    // 私有狀態
    const state = {
      isHost: false,
      hostId: null,
      roomId: null,
      isPlaying: false
    };
    
    // 私有DOM元素引用
    let controlsContainer = null;
    let controlButton = null;
    let debugInfo = null;
    let hostTitle = null;
    
    // 調試模式 - 設為 true 可強制顯示控制台
    const DEBUG_MODE = false;
    
    return {
      // 初始化
      init() {
        console.log('🎵 HostManager 初始化開始...');
        
        // 檢查 Socket 依賴
        if (!window.SocketManager) {
          console.error('❌ HostManager 初始化失敗: SocketManager 不存在');
          this.showErrorNotification('無法初始化房主模組：網路連接問題');
          return false;
        }
        
        // 獲取當前房間ID
        state.roomId = window.SocketManager.currentRoom?.id;
        if (!state.roomId) {
          console.error('❌ HostManager 初始化失敗: 未加入房間');
          this.showErrorNotification('無法初始化房主模組：未加入房間');
          return false;
        }
        
        // 設置事件監聽
        this.setupEventListeners();
        
        // 創建控制界面
        this.createControls();
        
        // 請求當前房主狀態
        this.requestHostStatus();
        
        // 確保房主標識顯示正確
        setTimeout(() => {
          this.updateHostIndicators();
        }, 1000);
        
        console.log('✅ HostManager 初始化完成');
        return true;
      },
      
      // 設置事件監聽
      setupEventListeners() {
        if (!window.SocketManager) return;
        
        console.log('🔄 設置 HostManager 事件監聽...');
        
        // 使用更明確的事件綁定方式
        const events = {
          'host-assigned': this.handleHostAssigned,
          'host-status': this.handleHostStatus,
          'host-changed': this.handleHostChanged,
          'circle-started': this.handleCircleStarted,
          'circle-stopped': this.handleCircleStopped,
          'user-joined': this.handleUserJoined,
          'room-joined': this.handleRoomJoined
        };
        
        // 綁定所有事件，並確保this指向正確
        for (const [event, handler] of Object.entries(events)) {
          window.SocketManager.on(event, handler.bind(this));
        }
        
        console.log('✅ HostManager 事件監聽設置完成');
      },
      
      // 處理加入房間事件 - 更新所有用戶的房主標識
      handleRoomJoined(data) {
        console.log('📥 收到 room-joined 事件，更新房主標識');
        setTimeout(() => this.updateHostIndicators(), 300);
      },
      
      // 處理用戶加入事件 - 更新所有用戶的房主標識
      handleUserJoined(data) {
        console.log('📥 收到 user-joined 事件，更新房主標識');
        setTimeout(() => this.updateHostIndicators(), 300);
      },
      
      // 請求當前房主狀態
      requestHostStatus() {
        if (!window.SocketManager) {
          console.error('❌ 無法請求房主狀態: SocketManager 不存在');
          return;
        }
        
        console.log('🔄 請求房主狀態...');
        
        // 使用新的安全發送方法
        const success = window.SocketManager.emitEvent('request-host-status', { 
          roomId: state.roomId 
        });
        
        if (!success) {
          console.warn('⚠️ 請求房主狀態未成功發送');
        }
        
        // 3秒後如果仍未收到回應，再次請求
        setTimeout(() => {
          if (state.hostId === null) {
            console.log('⚠️ 未收到房主狀態回應，再次請求...');
            window.SocketManager.emitEvent('request-host-status', { 
              roomId: state.roomId 
            });
          }
        }, 3000);
      },
      
      // 處理成為房主事件
      handleHostAssigned(data) {
        console.log('📥 收到 host-assigned 事件:', data);
        state.isHost = data.isHost;
        state.hostId = window.SocketManager.currentUser?.id;
        
        this.updateControlsVisibility();
        this.updateHostIndicators();
        
        if (state.isHost) {
          this.showNotification('👑 你已成為鼓圈指揮官！');
        }
        
        // 更新調試信息
        this.updateDebugInfo();
      },
      
      // 處理房主狀態更新
      handleHostStatus(data) {
        console.log('📥 收到 host-status 事件:', data);
        state.isHost = data.isHost;
        state.hostId = data.hostId;
        state.isPlaying = data.isPlaying;
        
        this.updateControlsVisibility();
        this.updateControlButton();
        this.updateHostIndicators();
        
        if (state.isHost) {
          this.showNotification('👑 你是鼓圈指揮官');
        }
        
        // 更新調試信息
        this.updateDebugInfo();
      },
      
      // 處理房主變更事件
      handleHostChanged(data) {
        console.log('📥 收到 host-changed 事件:', data);
        const wasHost = state.isHost;
        state.hostId = data.hostId;
        state.isHost = window.SocketManager.currentUser?.id === data.hostId;
        
        this.updateControlsVisibility();
        this.updateHostIndicators();
        
        // 如果變成了房主
        if (!wasHost && state.isHost) {
          this.showNotification('👑 你已成為新的鼓圈指揮官！');
        }
        // 如果看到別人成為房主
        else if (!state.isHost) {
          const hostName = this.getParticipantName(data.hostId) || `用戶 ${data.hostId}`;
          this.showNotification(`👑 ${hostName} 成為鼓圈指揮官`);
        }
        
        // 更新調試信息
        this.updateDebugInfo();
      },
      
      // 處理鼓圈開始事件
      handleCircleStarted(data) {
        console.log('📥 收到 circle-started 事件:', data);
        state.isPlaying = true;
        this.updateControlButton();
        
        if (!state.isHost) {
          this.showNotification('🎵 鼓圈開始！');
        }
        
        // 更新調試信息
        this.updateDebugInfo();
      },
      
      // 處理鼓圈停止事件
      handleCircleStopped() {
        console.log('📥 收到 circle-stopped 事件');
        state.isPlaying = false;
        this.updateControlButton();
        
        if (!state.isHost) {
          this.showNotification('🛑 鼓圈停止');
        }
        
        // 更新調試信息
        this.updateDebugInfo();
      },
      
      // 創建控制界面
      createControls() {
        console.log('🔄 創建房主控制界面...');
        
        // 檢查是否已經存在
        if (document.getElementById('hostControls')) {
          console.log('⚠️ 房主控制界面已存在，跳過創建');
          controlsContainer = document.getElementById('hostControls');
          controlButton = document.getElementById('controlCircleBtn');
          debugInfo = document.getElementById('hostDebugInfo');
          hostTitle = document.querySelector('.host-title');
          return;
        }
        
        // 創建控制容器
        controlsContainer = document.createElement('div');
        controlsContainer.id = 'hostControls';
        controlsContainer.className = 'host-controls';
        
        // 添加標題
        hostTitle = document.createElement('div');
        hostTitle.className = 'host-title';
        hostTitle.textContent = '👑 鼓圈指揮官控制台';
        controlsContainer.appendChild(hostTitle);
        
        // 創建控制按鈕
        controlButton = document.createElement('button');
        controlButton.id = 'controlCircleBtn';
        controlButton.className = 'control-circle-btn';
        controlButton.textContent = '開始鼓圈';
        controlButton.setAttribute('data-action', 'start');
        
        // 設置按鈕點擊事件
        controlButton.addEventListener('click', () => {
          console.log('🖱️ 控制按鈕被點擊');
          const action = controlButton.getAttribute('data-action');
          this.controlCircle(action);
        });
        
        // 添加按鈕到容器
        controlsContainer.appendChild(controlButton);
        
        // 調試信息區域
        debugInfo = document.createElement('div');
        debugInfo.id = 'hostDebugInfo';
        controlsContainer.appendChild(debugInfo);
        
        // 初始隱藏控制界面
        controlsContainer.style.display = 'none';
        
        // 添加到頁面
        const gameContainer = document.querySelector('.container');
        if (gameContainer) {
          gameContainer.appendChild(controlsContainer);
          console.log('✅ 房主控制界面已添加到遊戲容器');
        } else {
          document.body.appendChild(controlsContainer);
          console.log('✅ 房主控制界面已添加到 body');
        }
        
        // 初始更新調試信息
        this.updateDebugInfo();
      },
      
      // 更新控制界面顯示狀態
      updateControlsVisibility() {
        if (!controlsContainer) {
          console.warn('⚠️ 控制容器不存在，無法更新顯示狀態');
          return;
        }
        
        const shouldShow = state.isHost || DEBUG_MODE;
        controlsContainer.style.display = shouldShow ? 'block' : 'none';
        
        console.log(`${shouldShow ? '✅ 顯示' : '❌ 隱藏'} 房主控制界面 (isHost: ${state.isHost})`);
        
        // 強制顯示且提示，以便調試
        if (DEBUG_MODE && !state.isHost) {
          controlsContainer.style.borderColor = 'red';
          controlsContainer.style.opacity = '0.7';
          hostTitle.textContent = '👑 房主控制台 (調試模式)';
        } else if (state.isHost) {
          controlsContainer.style.borderColor = '#6C5CE7';
          controlsContainer.style.opacity = '1';
          hostTitle.textContent = '👑 鼓圈指揮官控制台';
        }
      },
      
      // 更新控制按鈕狀態
      updateControlButton() {
        if (!controlButton) {
          console.warn('⚠️ 控制按鈕不存在，無法更新狀態');
          return;
        }
        
        if (state.isPlaying) {
          controlButton.textContent = '停止鼓圈';
          controlButton.setAttribute('data-action', 'stop');
          controlButton.classList.add('playing');
          console.log('🔄 控制按鈕更新為「停止」狀態');
        } else {
          controlButton.textContent = '開始鼓圈';
          controlButton.setAttribute('data-action', 'start');
          controlButton.classList.remove('playing');
          console.log('🔄 控制按鈕更新為「開始」狀態');
        }
      },
      
      // 控制鼓圈
      controlCircle(action) {
        if (!window.SocketManager) {
          console.error('❌ 無法控制鼓圈: SocketManager 不存在');
          this.showErrorNotification('無法控制鼓圈：連接問題');
          return;
        }
        
        if (!state.isHost && !DEBUG_MODE) {
          console.warn('⚠️ 非房主嘗試控制鼓圈');
          this.showErrorNotification('只有鼓圈指揮官才能控制鼓圈');
          return;
        }
        
        console.log(`🔄 發送鼓圈控制命令: ${action}`);
        
        // 使用安全的發送方法
        const success = window.SocketManager.emitEvent('control-drum-circle', {
          roomId: state.roomId,
          action: action
        });
        
        if (!success) {
          this.showErrorNotification('發送控制命令失敗，請刷新頁面重試');
          return;
        }
        
        // 立即提供視覺反饋
        if (action === 'start') {
          this.showNotification('🎵 鼓圈開始！');
        } else {
          this.showNotification('🛑 鼓圈停止');
        }
      },
      
      // 更新所有房主標識
      updateHostIndicators() {
        // 如果沒有房主ID則返回
        if (!state.hostId) {
          console.warn('⚠️ 無法更新房主標識: 房主ID未知');
          return;
        }
        
        // 移除所有舊的主持人標記
        document.querySelectorAll('.host-cell').forEach(cell => {
          cell.classList.remove('host-cell');
        });
        
        console.log(`🔄 更新房主標識，當前房主ID: ${state.hostId}`);
        
        // 房主是自己
        if (state.hostId === window.SocketManager?.currentUser?.id) {
          const myCell = document.getElementById('cell-bottom-center');
          if (myCell) {
            myCell.classList.add('host-cell');
            console.log('✅ 已將房主標識添加到自己的格子');
          }
          return;
        }
        
        // 找到房主格子
        const cells = document.querySelectorAll('.grid-cell');
        cells.forEach(cell => {
          const userId = cell.getAttribute('data-user');
          if (userId === state.hostId) {
            cell.classList.add('host-cell');
            console.log(`✅ 已將房主標識添加到用戶 ${userId} 的格子`);
          }
        });
        
        // 嘗試找到顯示玩家名稱的元素並添加標識
        document.querySelectorAll('.user-info').forEach(info => {
          const cell = info.closest('.grid-cell');
          if (!cell) return;
          
          const userId = cell.getAttribute('data-user');
          if (userId === state.hostId) {
            // 檢查是否已存在房主標識
            if (!info.querySelector('.host-badge')) {
              const badge = document.createElement('span');
              badge.className = 'host-badge';
              badge.textContent = '👑 指揮官';
              info.appendChild(badge);
              console.log(`✅ 已將房主徽章添加到用戶 ${userId} 的名稱旁`);
            }
          }
        });
      },
      
      // 更新調試信息
      updateDebugInfo() {
        if (!debugInfo) return;
        
        // 隱藏非調試模式下的調試信息
        if (!DEBUG_MODE && !state.isHost) {
          debugInfo.style.display = 'none';
          return;
        }
        
        const currentUserId = window.SocketManager?.currentUser?.id || 'unknown';
        
        debugInfo.style.display = 'block';
        debugInfo.innerHTML = `
          Host ID: ${state.hostId || 'none'}<br>
          Your ID: ${currentUserId}<br>
          Is Host: ${state.isHost ? 'Yes' : 'No'}<br>
          Is Playing: ${state.isPlaying ? 'Yes' : 'No'}<br>
          Room ID: ${state.roomId || 'none'}
        `;
      },
      
      // 顯示通知
      showNotification(message) {
        // 移除現有通知
        const existingNotifications = document.querySelectorAll('.host-notification');
        existingNotifications.forEach(n => n.remove());
        
        // 創建新通知
        const notification = document.createElement('div');
        notification.className = 'host-notification';
        notification.textContent = message;
        
        // 添加到頁面
        document.body.appendChild(notification);
        
        console.log(`📣 顯示通知: ${message}`);
        
        // 3秒後自動消失
        setTimeout(() => {
          notification.classList.add('fade-out');
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 500);
        }, 3000);
      },
      
      // 顯示錯誤通知
      showErrorNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'host-notification';
        notification.textContent = `❌ ${message}`;
        notification.style.borderLeft = '5px solid #ff5252';
        
        document.body.appendChild(notification);
        
        console.error(`❌ 錯誤通知: ${message}`);
        
        setTimeout(() => {
          notification.classList.add('fade-out');
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 500);
        }, 4000);
      },
      
      // 獲取參與者名稱
      getParticipantName(userId) {
        // 如果是當前用戶
        if (userId === window.SocketManager?.currentUser?.id) {
          return window.SocketManager.currentUser.name || '你';
        }
        
        // 嘗試從UI中獲取名稱
        const cells = document.querySelectorAll('.grid-cell');
        for (const cell of cells) {
          if (cell.getAttribute('data-user') === userId) {
            const nameElement = cell.querySelector('.user-info');
            if (nameElement) {
              return nameElement.textContent;
            }
          }
        }
        
        return null;
      },
      
      // 公開方法: 檢查當前用戶是否為房主
      isUserHost() {
        return state.isHost;
      },
      
      // 公開方法: 獲取當前房主ID
      getCurrentHostId() {
        return state.hostId;
      },
      
      // 公開方法: 檢查鼓圈是否正在進行
      isCirclePlaying() {
        return state.isPlaying;
      },
      
      // 公開方法: 強制重新檢查狀態
      forceRefresh() {
        console.log('🔄 強制重新檢查房主狀態...');
        this.requestHostStatus();
        this.updateControlsVisibility();
        this.updateHostIndicators();
        this.updateDebugInfo();
        return state;
      }
    };
  })();
  
  // 將模組暴露到全局
  window.HostManager = HostManager;
  
  // 調試功能：在主頁加載1秒後自動檢查房主狀態
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
      if (window.HostManager) {
        console.log('🔍 自動檢查房主狀態...');
        window.HostManager.forceRefresh();
      }
    }, 1000);
  });