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
    
    return {
      // 初始化
      init() {
        // 檢查 Socket 依賴
        if (!window.SocketManager) {
          console.error('HostManager 初始化失敗: SocketManager 不存在');
          return false;
        }
        
        // 獲取當前房間ID
        state.roomId = window.SocketManager.currentRoom?.id;
        if (!state.roomId) {
          console.error('HostManager 初始化失敗: 未加入房間');
          return false;
        }
        
        // 設置事件監聽
        window.SocketManager.on('host-assigned', this.handleHostAssigned.bind(this));
        window.SocketManager.on('host-status', this.handleHostStatus.bind(this));
        window.SocketManager.on('host-changed', this.handleHostChanged.bind(this));
        window.SocketManager.on('circle-started', this.handleCircleStarted.bind(this));
        window.SocketManager.on('circle-stopped', this.handleCircleStopped.bind(this));
        
        // 請求當前房主狀態
        window.SocketManager.socket.emit('request-host-status', { roomId: state.roomId });
        
        // 創建控制界面
        this.createControls();
        
        return true;
      },
      
      // 處理成為房主事件
      handleHostAssigned(data) {
        state.isHost = data.isHost;
        state.hostId = window.SocketManager.currentUser?.id;
        
        this.updateControlsVisibility();
        
        if (state.isHost) {
          this.showNotification('你已成為鼓圈指揮官');
        }
      },
      
      // 處理房主狀態更新
      handleHostStatus(data) {
        state.isHost = data.isHost;
        state.hostId = data.hostId;
        state.isPlaying = data.isPlaying;
        
        this.updateControlsVisibility();
        this.updateControlButton();
        
        if (state.isHost) {
          this.showNotification('你是鼓圈指揮官');
        }
      },
      
      // 處理房主變更事件
      handleHostChanged(data) {
        const wasHost = state.isHost;
        state.hostId = data.hostId;
        state.isHost = window.SocketManager.currentUser?.id === data.hostId;
        
        this.updateControlsVisibility();
        
        // 如果變成了房主
        if (!wasHost && state.isHost) {
          this.showNotification('你已成為新的鼓圈指揮官');
        }
        // 如果看到別人成為房主
        else if (!state.isHost) {
          const hostName = this.getParticipantName(state.hostId) || state.hostId;
          this.showNotification(`${hostName} 成為鼓圈指揮官`);
        }
      },
      
      // 處理鼓圈開始事件
      handleCircleStarted(data) {
        state.isPlaying = true;
        this.updateControlButton();
        
        if (!state.isHost) {
          this.showNotification('鼓圈開始');
        }
      },
      
      // 處理鼓圈停止事件
      handleCircleStopped() {
        state.isPlaying = false;
        this.updateControlButton();
        
        if (!state.isHost) {
          this.showNotification('鼓圈停止');
        }
      },
      
      // 創建控制界面
      createControls() {
        // 創建控制容器
        controlsContainer = document.createElement('div');
        controlsContainer.id = 'hostControls';
        controlsContainer.className = 'host-controls';
        
        // 創建控制按鈕
        controlButton = document.createElement('button');
        controlButton.id = 'controlCircleBtn';
        controlButton.className = 'control-circle-btn';
        controlButton.textContent = '開始鼓圈';
        controlButton.setAttribute('data-action', 'start');
        
        // 設置按鈕點擊事件
        controlButton.addEventListener('click', () => {
          const action = controlButton.getAttribute('data-action');
          this.controlCircle(action);
        });
        
        // 添加按鈕到容器
        controlsContainer.appendChild(controlButton);
        
        // 初始隱藏控制界面
        controlsContainer.style.display = 'none';
        
        // 添加到頁面
        const gameContainer = document.querySelector('.container');
        if (gameContainer) {
          gameContainer.appendChild(controlsContainer);
        } else {
          document.body.appendChild(controlsContainer);
        }
      },
      
      // 更新控制界面顯示狀態
      updateControlsVisibility() {
        if (!controlsContainer) return;
        
        controlsContainer.style.display = state.isHost ? 'block' : 'none';
      },
      
      // 更新控制按鈕狀態
      updateControlButton() {
        if (!controlButton) return;
        
        if (state.isPlaying) {
          controlButton.textContent = '停止鼓圈';
          controlButton.setAttribute('data-action', 'stop');
          controlButton.classList.add('playing');
        } else {
          controlButton.textContent = '開始鼓圈';
          controlButton.setAttribute('data-action', 'start');
          controlButton.classList.remove('playing');
        }
      },
      
      // 控制鼓圈
      controlCircle(action) {
        if (!state.isHost || !window.SocketManager) return;
        
        window.SocketManager.socket.emit('control-drum-circle', {
          roomId: state.roomId,
          action: action
        });
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
      
      // 獲取參與者名稱
      getParticipantName(userId) {
        // 如果SocketManager有參與者列表，則從中獲取名稱
        if (window.SocketManager && window.SocketManager.getRoomParticipants) {
          const participants = window.SocketManager.getRoomParticipants(state.roomId);
          const participant = participants.find(p => p.id === userId);
          if (participant && participant.name) {
            return participant.name;
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
      }
    };
  })();
  
  // 將模組暴露到全局
  window.HostManager = HostManager;