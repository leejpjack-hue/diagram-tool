# 🔍 里程碑調試指南

## 問題
里程碑菱形無法顯示

## 調試步驟

### 1. 刷新並加載 MVP Sprint
```
1. 硬刷新瀏覽器 (Ctrl+Shift+R)
2. 打開瀏覽器控制台 (F12)
3. 點擊 File → Load MVP Sprint
4. 查看控制台輸出
```

### 2. 檢查 Parser 日誌
應該看到：
```
[Parser] Parsed milestone for task "Testing & Docs": true (value: true)
[Parser] Parsed tasks: [
  {
    name: "Testing & Docs",
    milestone: true,
    start: ...,
    end: ...
  }
]
```

### 3. 檢查渲染日誌
應該看到：
```
[Milestone] Task: Testing & Docs, milestone prop: true, isMilestone: true, days: 0
```

### 4. 檢查任務數據
在控制台輸入：
```javascript
useGanttStore.getState().tasks.filter(t => t.milestone)
```

應該返回有 milestone: true 的任務。

## 可能的問題

### 問題 1: Parser 未正確解析
**症狀:** 控制台沒有 [Parser] milestone 日誌
**原因:** DSL 格式問題
**解決:** 檢查 DSL 中的 `milestone: true` 是否正確

### 問題 2: 任務對象沒有 milestone 屬性
**症狀:** milestone prop 為 undefined
**原因:** Parser 未傳遞屬性
**解決:** 檢查 finalizeTask 函數

### 問題 3: 渲染邏輯問題
**症狀:** isMilestone 為 false
**原因:** diffDays 計算錯誤
**解決:** 檢查日期計算

### 問題 4: SVG 渲染問題
**症狀:** isMilestone 為 true 但看不到菱形
**原因:** SVG 座標或樣式問題
**解決:** 檢查瀏覽器開發者工具的 Elements 面板

## 下一步

請執行上述調試步驟並提供：
1. 控制台日誌輸出
2. useGanttStore.getState().tasks 的結果
3. 是否看到菱形（即使很小）

這將幫助我定位問題所在！
