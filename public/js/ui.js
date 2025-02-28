// 用戶界面管理模組
const UIManager = (function() {
    // 用戶與格子的映射
    const userCellMap = new Map();
    // 高亮效果持續時間（毫秒）
    const HIGHLIGHT_DURATION = 300;
  
    // 初始化用戶界面
    function init() {
      // 設置鼓聲選擇下拉框的事件處理
      const drumSelect = document.getElementById('drumSelect');
      if (drumSelect) {
        drumSelect.addEventListener('change', (e) => {
          const selectedDrum = e.target.value;
          if (window.SocketManager) {
            window.SocketManager.setDrumType(selectedDrum);
            console.log(`已選擇鼓聲: ${selectedDrum}`);
          }
        });
      }
      
      console.log('用戶界面已初始化');
    }
  
    // 更新所有用戶格子
    function updateUserCells(users) {
      // 清空現有映射
      userCellMap.clear();
      
      // 重置格子內容
      resetGridCells();
      
      // 添加用戶到格子
      users.forEach(user => {
        if (user.id !== window.SocketManager.currentUser.id) {
          addUserToCell(user.id, user.position);
        }
      });
      
      console.log('用戶格子已更新', users.length);
    }
  
    // 重置所有格子
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
  
    // 添加用戶到格子
    function addUserToCell(userId, position) {
      const cellId = `cell-${position}`;
      const cell = document.getElementById(cellId);
      
      if (cell) {
        // 提取用戶ID的數字部分
        const userNumber = userId.split('-')[1];
        
        // 設置格子內容
        cell.innerHTML = `<div class="user-info">用戶 ${userNumber}</div>`;
        cell.setAttribute('data-user', userId);
        cell.classList.add('occupied');
        
        // 記錄映射
        userCellMap.set(userId, cellId);
        console.log(`用戶 ${userId} 已添加到格子 ${cellId}`);
      } else {
        console.warn(`找不到格子: ${cellId}`);
      }
    }
  
    // 從格子移除用戶
    function removeUserFromCell(userId) {
      const cellId = userCellMap.get(userId);
      if (cellId) {
        const cell = document.getElementById(cellId);
        if (cell) {
          cell.innerHTML = '';
          cell.setAttribute('data-user', '');
          cell.classList.remove('occupied');
          console.log(`已從格子 ${cellId} 移除用戶 ${userId}`);
        }
        
        userCellMap.delete(userId);
      } else {
        console.warn(`找不到用戶 ${userId} 的格子`);
      }
    }
  
    // 高亮用戶格子
    function highlightUserCell(userId) {
      let cellId;
      
      if (userId === window.SocketManager.currentUser.id) {
        cellId = 'cell-bottom-center';
      } else {
        cellId = userCellMap.get(userId);
      }
      
      if (cellId) {
        const cell = document.getElementById(cellId);
        if (cell) {
          // 添加高亮效果
          cell.classList.add('highlight');
          
          // 設定延時移除高亮
          setTimeout(() => {
            cell.classList.remove('highlight');
          }, HIGHLIGHT_DURATION);
          
          return true;
        }
      }
      
      return false;
    }
  
    // 暴露公共方法
    return {
      init,
      updateUserCells,
      addUserToCell,
      removeUserFromCell,
      highlightUserCell
    };
  })();
  
  // 導出模組
  window.UIManager = UIManager;