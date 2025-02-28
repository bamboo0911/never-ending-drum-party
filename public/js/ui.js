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

      // 監聽聲音播放事件
      document.addEventListener('sound-played', handleSoundPlayed);
      
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

    // 處理聲音播放事件
    function handleSoundPlayed(event) {
      const { soundName, analyser, dataArray } = event.detail;
      
      // 根據聲音類型設置不同的視覺效果顏色
      let effectColor;
      switch (soundName) {
        case 'kick':
          effectColor = '#ff5252'; // 紅色
          break;
        case 'snare':
          effectColor = '#ffeb3b'; // 黃色
          break;
        case 'hihat':
          effectColor = '#4caf50'; // 綠色
          break;
        case 'tom':
          effectColor = '#2196f3'; // 藍色
          break;
        case 'crash':
          effectColor = '#e040fb'; // 紫色
          break;
        default:
          effectColor = '#ffffff'; // 白色
      }
      
      // 創建音頻可視化波形動畫
      createWaveEffect(soundName, effectColor, analyser, dataArray);
    }

    // 創建波形動畫效果
    function createWaveEffect(soundName, color, analyser, dataArray) {
      // 找到對應的高亮單元格
      let targetCell = null;
      
      // 根據當前播放聲音找到對應用戶
      document.querySelectorAll('.grid-cell').forEach(cell => {
        const userId = cell.getAttribute('data-user');
        if (userId) {
          // 檢查用戶是否正在使用這種鼓聲
          if (cell.querySelector('.user-info') && 
              cell.querySelector('.user-info').textContent.includes(soundName)) {
            targetCell = cell;
          }
        }
      });
      
      // 如果找不到特定單元格，使用通用高亮
      if (!targetCell) {
        // 檢查是否是當前用戶的聲音
        const currentUserCell = document.getElementById('cell-bottom-center');
        if (document.getElementById('drumSelect').value === soundName) {
          targetCell = currentUserCell;
        }
      }
      
      // 如果找到目標單元格，添加視覺效果
      if (targetCell) {
        // 創建波形容器
        const waveContainer = document.createElement('div');
        waveContainer.className = 'sound-wave';
        waveContainer.style.position = 'absolute';
        waveContainer.style.bottom = '0';
        waveContainer.style.left = '0';
        waveContainer.style.width = '100%';
        waveContainer.style.height = '30%';
        waveContainer.style.overflow = 'hidden';
        waveContainer.style.pointerEvents = 'none';
        
        targetCell.appendChild(waveContainer);
        
        // 創建波形元素
        const waveElements = [];
        const waveCount = 5;
        
        for (let i = 0; i < waveCount; i++) {
          const wave = document.createElement('div');
          wave.style.position = 'absolute';
          wave.style.bottom = '0';
          wave.style.left = `${(i / waveCount) * 100}%`;
          wave.style.width = `${100 / waveCount}%`;
          wave.style.height = '0%';
          wave.style.backgroundColor = color;
          wave.style.opacity = '0.7';
          wave.style.borderRadius = '50% 50% 0 0';
          wave.style.transition = 'height 150ms ease-out';
          
          waveContainer.appendChild(wave);
          waveElements.push(wave);
        }
        
        // 基於音頻數據更新波形
        function updateWaveform() {
          if (!analyser) return;
          
          analyser.getByteFrequencyData(dataArray);
          
          // 獲取平均音量
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avgVolume = sum / dataArray.length;
          
          // 更新波形高度
          waveElements.forEach((wave, index) => {
            // 為每個波形元素計算略有不同的高度
            const segment = Math.floor(dataArray.length / waveElements.length);
            const startIndex = index * segment;
            
            let segmentSum = 0;
            for (let i = 0; i < segment; i++) {
              if (startIndex + i < dataArray.length) {
                segmentSum += dataArray[startIndex + i];
              }
            }
            
            const segmentAvg = segmentSum / segment;
            const height = Math.min(100, (segmentAvg / 255) * 120);
            
            wave.style.height = `${height}%`;
          });
          
          // 如果音量太低，停止動畫
          if (avgVolume < 10) {
            clearInterval(animationId);
            setTimeout(() => {
              if (waveContainer && waveContainer.parentNode) {
                waveContainer.remove();
              }
            }, 300);
          }
        }
        
        // 啟動動畫
        const animationId = setInterval(updateWaveform, 50);
        
        // 設置波形元素自動清除
        setTimeout(() => {
          clearInterval(animationId);
          if (waveContainer && waveContainer.parentNode) {
            waveContainer.remove();
          }
        }, 2000);
      }
    }
  
    // 高亮用戶格子
    function highlightUserCell(userId, soundType = null) {
      let cellId;
      
      if (userId === window.SocketManager.currentUser.id) {
        cellId = 'cell-bottom-center';
      } else {
        cellId = userCellMap.get(userId);
      }
      
      if (cellId) {
        const cell = document.getElementById(cellId);
        if (cell) {
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
          const originalBg = cell.style.backgroundColor || 
                           window.getComputedStyle(cell).backgroundColor;
          
          // 添加高亮效果
          cell.classList.add('highlight');
          cell.style.backgroundColor = highlightColor;
          cell.style.boxShadow = `0 0 20px ${highlightColor}`;
          
          // 創建脈衝動畫
          const pulse = document.createElement('div');
          pulse.className = 'pulse-effect';
          pulse.style.position = 'absolute';
          pulse.style.top = '50%';
          pulse.style.left = '50%';
          pulse.style.transform = 'translate(-50%, -50%)';
          pulse.style.width = '10px';
          pulse.style.height = '10px';
          pulse.style.borderRadius = '50%';
          pulse.style.backgroundColor = highlightColor;
          pulse.style.boxShadow = `0 0 10px ${highlightColor}`;
          pulse.style.opacity = '0.8';
          pulse.style.pointerEvents = 'none';
          
          cell.appendChild(pulse);
          
          // 執行脈衝動畫
          let scale = 1;
          const pulseAnimation = setInterval(() => {
            scale += 0.2;
            pulse.style.transform = `translate(-50%, -50%) scale(${scale})`;
            pulse.style.opacity = Math.max(0, 0.8 - (scale - 1) / 5);
            
            if (scale >= 6) {
              clearInterval(pulseAnimation);
              if (pulse.parentNode) {
                pulse.remove();
              }
            }
          }, 30);
          
          // 設定延時移除高亮
          setTimeout(() => {
            cell.classList.remove('highlight');
            cell.style.backgroundColor = originalBg;
            cell.style.boxShadow = '';
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
      highlightUserCell,
      handleSoundPlayed,
      createWaveEffect
    };
  })();
  
  // 導出模組
  window.UIManager = UIManager;