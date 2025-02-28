// 極簡化的UI管理模組
const UIManager = (function() {
    // 用戶與格子的映射
    const userCellMap = new Map();
    // 高亮效果持續時間（毫秒）- 非常短的閃爍
    const HIGHLIGHT_DURATION = 80;
    // 活躍的動畫計時器
    const activeTimers = new Map();
  
    /**
     * 初始化用戶界面
     */
    function init() {
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
      
      console.log('用戶界面已初始化');
      return true;
    }
  
    /**
     * 更新所有用戶格子
     */
    function updateUserCells(users) {
      // 清空現有映射
      userCellMap.clear();
      
      // 重置格子內容
      resetGridCells();
      
      // 添加用戶到格子
      if (users && Array.isArray(users)) {
        users.forEach(user => {
          if (user.id !== window.SocketManager?.currentUser?.id) {
            addUserToCell(user.id, user.position);
          }
        });
      }
    }
  
    /**
     * 重置所有格子
     */
    function resetGridCells() {
      document.querySelectorAll('.grid-cell').forEach(cell => {
        // 跳過中心和中下位置
        if (cell.id !== 'cell-center' && cell.id !== 'cell-bottom-center') {
          cell.innerHTML = '';
          cell.setAttribute('data-user', '');
          cell.classList.remove('occupied');
        }
      });
    }
  
    /**
     * 添加用戶到格子
     */
    function addUserToCell(userId, position) {
      const cellId = `cell-${position}`;
      const cell = document.getElementById(cellId);
      
      if (cell) {
        // 提取用戶ID的數字部分
        const userNumber = userId.split('-')[1] || userId;
        
        // 設置格子內容
        cell.innerHTML = `<div class="user-info">用戶 ${userNumber}</div>`;
        cell.setAttribute('data-user', userId);
        cell.classList.add('occupied');
        
        // 記錄映射
        userCellMap.set(userId, cellId);
      }
    }
  
    /**
     * 從格子移除用戶
     */
    function removeUserFromCell(userId) {
      const cellId = userCellMap.get(userId);
      if (cellId) {
        const cell = document.getElementById(cellId);
        if (cell) {
          cell.innerHTML = '';
          cell.setAttribute('data-user', '');
          cell.classList.remove('occupied');
        }
        
        userCellMap.delete(userId);
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
      return userCellMap.get(userId) || null;
    }
  
    // 暴露公共方法
    return {
      init,
      updateUserCells,
      addUserToCell,
      removeUserFromCell,
      highlightUserCell,
      handleSoundPlayed,
      getCellId // 新增的方法
    };
  })();
  
  // 導出模組
  window.UIManager = UIManager;