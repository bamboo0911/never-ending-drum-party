// 改進的UI管理模組 - 確保正確處理房間成員和位置
const UIManager = (function() {
    // 用戶與格子的映射
    const userCellMap = new Map();
    // 高亮效果持續時間（毫秒）- 非常短的閃爍
    const HIGHLIGHT_DURATION = 80;
    // 活躍的動畫計時器
    const activeTimers = new Map();
    // 調試模式
    const DEBUG_MODE = false;
  
    /**
     * 初始化用戶界面
     */
    function init() {
      console.log('UI管理器初始化中...');
      
      // 設置鼓聲選擇下拉框的事件處理
      const drumSelect = document.getElementById('drumSelect');
      if (drumSelect) {
        drumSelect.addEventListener('change', (e) => {
          const selectedDrum = e.target.value;
          if (window.SocketManager) {
            window.SocketManager.setDrumType(selectedDrum);
          }
        });
      }
      
      // 監聽房間加入和用戶加入事件，確保UI更新
      if (window.SocketManager) {
        window.SocketManager.on('room-joined', handleRoomJoined);
        window.SocketManager.on('user-joined', handleUserJoined);
        window.SocketManager.on('user-left', handleUserLeft);
        window.SocketManager.on('room-users-updated', handleRoomUsersUpdated);
      }
      
      // 自動請求房間成員列表（確保新加入用戶能看到所有成員）
      setTimeout(() => {
        if (window.SocketManager && typeof window.SocketManager.requestRoomUsers === 'function') {
          window.SocketManager.requestRoomUsers();
        }
      }, 2000);
      
      // 確保本地用戶格子是正確的
      const bottomCenterCell = document.getElementById('cell-bottom-center');
      if (bottomCenterCell && window.SocketManager && window.SocketManager.currentUser) {
        const playerName = window.SocketManager.currentUser.name || 
                          localStorage.getItem('playerName') || 
                          '您';
                           
        if (!bottomCenterCell.querySelector('.user-info')) {
          bottomCenterCell.innerHTML = `<div class="user-info">${playerName}</div>`;
        }
      }
      
      console.log('UI管理器初始化完成');
      return true;
    }
    
    /**
     * 處理房間加入事件
     */
    function handleRoomJoined(data) {
      console.log('UI處理房間加入事件:', data);
      if (data && Array.isArray(data.users)) {
        updateUserCells(data.users);
      }
    }
    
    /**
     * 處理用戶加入事件
     */
    function handleUserJoined(data) {
      console.log('UI處理用戶加入事件:', data);
      if (data && data.userId) {
        addUserToCell(data);
      }
    }
    
    /**
     * 處理用戶離開事件
     */
    function handleUserLeft(data) {
      console.log('UI處理用戶離開事件:', data);
      if (data && data.userId) {
        removeUserFromCell(data.userId);
      }
    }
    
    /**
     * 處理房間用戶列表更新事件
     */
    function handleRoomUsersUpdated(data) {
      console.log('UI處理房間用戶列表更新:', data);
      if (data && Array.isArray(data.users)) {
        updateUserCells(data.users);
      }
    }
  
    /**
     * 更新所有用戶格子 - 確保不覆蓋本地用戶格子
     */
    function updateUserCells(users) {
        console.log('更新所有用戶格子，總人數:', users.length);
        
        // 清空現有映射
        userCellMap.clear();
        
        // 重置格子內容 - 確保不清除本地用戶格子
        resetGridCells();
        
        // 確保本地用戶ID
        const localUserId = window.SocketManager?.currentUser?.id;
        
        // 添加用戶到格子，跳過當前用戶
        if (users && Array.isArray(users)) {
          users.forEach(user => {
            // 跳過本地用戶
            if (user.id === localUserId) {
              console.log(`跳過本地用戶 ${user.id}`);
              return;
            }
            
            // 禁止其他用戶佔用 bottom-center 位置
            if (user.position === 'bottom-center') {
              console.warn(`用戶 ${user.id} 的位置是 bottom-center，這應該被保留給本地用戶！跳過添加`);
              return;
            }
            
            console.log(`添加用戶 ${user.id} 到格子 ${user.position || '未知位置'}`);
            addUserToCell(user);
          });
        }
        
        // 添加房主標記（如果有HostManager）
        if (window.HostManager && typeof window.HostManager.updateHostIndicators === 'function') {
          setTimeout(() => {
            window.HostManager.updateHostIndicators();
          }, 300);
        }
      }
  
    /**
     * 重置所有格子 - 確保不清除 bottom-center
     */
    function resetGridCells() {
      document.querySelectorAll('.grid-cell').forEach(cell => {
        // 跳過中心和中下位置
        if (cell.id !== 'cell-center' && cell.id !== 'cell-bottom-center') {
          cell.innerHTML = '';
          cell.setAttribute('data-user', '');
          cell.classList.remove('occupied');
          cell.classList.remove('host-cell');
        }
      });
      
      if (DEBUG_MODE) console.log('格子已重置（保留本地用戶格子）');
    }
  
    /**
     * 添加用戶到格子 - 確保不使用 bottom-center
     */
    function addUserToCell(user) {
        // 確保有位置信息
        const position = user.position;
        if (!position) {
          console.warn(`用戶 ${user.id} 沒有位置信息，無法添加到格子`);
          return;
        }
        
        // 禁止使用 bottom-center
        if (position === 'bottom-center') {
          console.warn(`嘗試將用戶 ${user.id} 添加到 bottom-center，這是不允許的！`);
          return;
        }
        
        const cellId = `cell-${position}`;
        const cell = document.getElementById(cellId);
        
        if (!cell) {
          console.warn(`找不到格子 ${cellId}`);
          return;
        }
        
        // 確保這不是本地用戶格子
        if (cellId === 'cell-bottom-center') {
          console.warn(`嘗試將用戶 ${user.id} 添加到本地用戶格子，已阻止`);
          return;
        }
        
        // 使用玩家的 name，若無則回退到從 ID 中提取數字
        const displayName = user.name ? user.name : `用戶 ${user.id.split('-')[1] || user.id}`;
        
        console.log(`添加用戶 ${displayName} (${user.id}) 到格子 ${cellId}`);
        
        // 設置格子內容
        cell.innerHTML = `<div class="user-info">${displayName}</div>`;
        cell.setAttribute('data-user', user.id);
        cell.classList.add('occupied');
        
        // 記錄映射
        userCellMap.set(user.id, cellId);
        
        // 添加房主標記 (如果需要)
        if (window.HostManager && 
            window.HostManager.getCurrentHostId && 
            window.HostManager.getCurrentHostId() === user.id) {
          cell.classList.add('host-cell');
          const userInfo = cell.querySelector('.user-info');
          if (userInfo && !userInfo.querySelector('.host-badge')) {
            const badge = document.createElement('span');
            badge.className = 'host-badge';
            badge.textContent = '👑 指揮官';
            userInfo.appendChild(badge);
          }
        }
      }
  
    /**
     * 從格子移除用戶 - 確保不移除本地用戶
     */
    function removeUserFromCell(userId) {
      // 確保不是本地用戶
      if (userId === window.SocketManager?.currentUser?.id) {
        console.warn(`嘗試移除本地用戶 ${userId}，已阻止`);
        return;
      }
      
      console.log(`嘗試從格子移除用戶 ${userId}`);
      
      const cellId = userCellMap.get(userId);
      if (cellId) {
        // 再次檢查不是本地用戶格子
        if (cellId === 'cell-bottom-center') {
          console.warn(`嘗試清除本地用戶格子，已阻止`);
          return;
        }
        
        const cell = document.getElementById(cellId);
        if (cell) {
          cell.innerHTML = '';
          cell.setAttribute('data-user', '');
          cell.classList.remove('occupied');
          cell.classList.remove('host-cell');
          console.log(`已從格子 ${cellId} 移除用戶 ${userId}`);
        }
        
        userCellMap.delete(userId);
      } else {
        console.log(`找不到用戶 ${userId} 對應的格子`);
      }
    }
  
    /**
     * 處理聲音播放事件（移除動畫效果，僅閃爍）
     */
    function handleSoundPlayed(event) {
      // 忽略此事件，由highlightUserCell處理所有視覺效果
    }
  
    /**
     * 高亮用戶格子 - 極簡版，只做顏色閃爍
     */
    function highlightUserCell(userId, soundType = null) {
      let cellId;
      
      if (userId === window.SocketManager?.currentUser?.id) {
        cellId = 'cell-bottom-center';
      } else {
        cellId = userCellMap.get(userId);
      }
      
      if (!cellId) return false;
      
      const cell = document.getElementById(cellId);
      if (!cell) return false;
      
      // 取消現有計時器
      if (activeTimers.has(cellId)) {
        clearTimeout(activeTimers.get(cellId));
      }
      
      // 根據聲音類型設置不同的高亮顏色
      let highlightColor = '#ffcc00'; // 默認黃色
      
      if (soundType) {
        switch (soundType) {
          case 'kick':
            highlightColor = '#ff5252'; // 紅色
            break;
          case 'snare':
            highlightColor = '#ffeb3b'; // 黃色
            break;
          case 'hihat':
            highlightColor = '#4caf50'; // 綠色
            break;
          case 'tom':
            highlightColor = '#2196f3'; // 藍色
            break;
          case 'crash':
            highlightColor = '#e040fb'; // 紫色
            break;
        }
      }
      
      // 保存原始背景色
      const originalBg = cell.dataset.originalBg || 
                       window.getComputedStyle(cell).backgroundColor;
      
      // 保存原始背景色到數據集
      if (!cell.dataset.originalBg) {
        cell.dataset.originalBg = originalBg;
      }
      
      // 立即應用高亮效果
      cell.style.backgroundColor = highlightColor;
      cell.style.boxShadow = `0 0 10px ${highlightColor}`;
      
      // 設定延時恢復原狀
      const timerId = setTimeout(() => {
        cell.style.backgroundColor = cell.dataset.originalBg;
        cell.style.boxShadow = '';
        activeTimers.delete(cellId);
      }, HIGHLIGHT_DURATION);
      
      // 存儲計時器以便在需要時取消
      activeTimers.set(cellId, timerId);
      
      return true;
    }
  
    /**
     * 取得用戶對應的格子 ID
     * @param {string} userId - 用戶 ID
     * @returns {string|null} 對應的格子 ID 或 null
     */
    function getCellId(userId) {
      // 檢查是否為本地用戶
      if (userId === window.SocketManager?.currentUser?.id) {
        return 'cell-bottom-center';
      }
      
      return userCellMap.get(userId) || null;
    }
    
    /**
     * 強制刷新所有格子
     */
    function forceRefreshCells() {
      console.log('強制刷新所有格子...');
      
      // 請求最新的房間成員列表
      if (window.SocketManager && typeof window.SocketManager.requestRoomUsers === 'function') {
        window.SocketManager.requestRoomUsers();
      }
      
      // 使用當前的用戶列表刷新
      if (window.SocketManager && window.SocketManager.currentRoom && Array.isArray(window.SocketManager.currentRoom.users)) {
        updateUserCells(window.SocketManager.currentRoom.users);
      }
      
      // 確保本地用戶格子是正確的
      ensureLocalUserCell();
    }
    
    /**
     * 確保本地用戶格子存在且正確
     */
    function ensureLocalUserCell() {
      const bottomCenterCell = document.getElementById('cell-bottom-center');
      if (!bottomCenterCell) return;
      
      // 獲取本地用戶名稱
      const localUser = window.SocketManager?.currentUser;
      if (!localUser) return;
      
      const playerName = localUser.name || 
                        localStorage.getItem('playerName') || 
                        '您';
      
      // 檢查格子是否已包含用戶信息
      if (!bottomCenterCell.querySelector('.user-info')) {
        bottomCenterCell.innerHTML = `<div class="user-info">${playerName}</div>`;
        bottomCenterCell.setAttribute('data-user', localUser.id);
        console.log(`確保本地用戶 ${playerName} 在 bottom-center 格子`);
      }
      
      // 添加本地用戶房主標記
      if (window.HostManager && 
          window.HostManager.isUserHost && 
          window.HostManager.isUserHost()) {
        bottomCenterCell.classList.add('host-cell');
        
        // 添加房主標記
        const userInfo = bottomCenterCell.querySelector('.user-info');
        if (userInfo && !userInfo.querySelector('.host-badge')) {
          const badge = document.createElement('span');
          badge.className = 'host-badge';
          badge.textContent = '👑 指揮官';
          userInfo.appendChild(badge);
          console.log('已添加本地用戶房主標記');
        }
      }
    }
  
    // 暴露公共方法
    return {
      init,
      updateUserCells,
      addUserToCell,
      removeUserFromCell,
      highlightUserCell,
      handleSoundPlayed,
      getCellId,
      forceRefreshCells,
      ensureLocalUserCell  // 新增：確保本地用戶格子
    };
  })();
  
  // 導出模組
  window.UIManager = UIManager;