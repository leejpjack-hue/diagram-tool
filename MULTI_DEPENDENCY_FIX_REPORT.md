# 🐛 多依賴關係 Bug 修復報告

## 問題描述

當任務有多個依賴關係時，以下功能都不正常工作：
- ❌ Auto-schedule（自動排程）
- ❌ Delay impact（延遲影響）
- ❌ Critical path（關鍵路徑）
- ❌ Diagram（圖表）

這些功能會漏算有多個依賴關係的任務。

## 根本原因

### 錯誤代碼（ganttParser.ts:140-147）
```typescript
// 錯誤：覆蓋之前的依賴
currentTask.dependencies = [parsed.name];
currentTask.dependencyDetails = [{
  predecessorId: parsed.name,
  successorId: currentTask.id || '',
  type: parsed.type,
  lag: parsed.lag,
}];
```

**問題：**
- 當解析多個 `depends:` 行時
- 每次都會**覆蓋**之前的依賴
- 結果：只保留最後一個依賴！

### 示例

**DSL:**
```
task "Task C" {
  depends: "Task A"
  depends: "Task B"
}
```

**錯誤結果：**
```javascript
dependencies: ["Task B"]  // 只有最後一個！
```

**正確結果：**
```javascript
dependencies: ["Task A", "Task B"]  // 所有依賴
```

## 修復方案

### 正確代碼
```typescript
// 正確：添加到數組
if (!currentTask.dependencies) {
  currentTask.dependencies = [];
}
if (!currentTask.dependencyDetails) {
  currentTask.dependencyDetails = [];
}

// 使用 push 而不是覆蓋
currentTask.dependencies.push(parsed.name);
currentTask.dependencyDetails.push({
  predecessorId: parsed.name,
  successorId: currentTask.id || '',
  type: parsed.type,
  lag: parsed.lag,
});
```

## 影響範圍

### 1. Auto-schedule
**Before:**
- 只考慮一個依賴
- 可能排程錯誤

**After:**
- 考慮所有依賴
- 正確的最早開始日期

### 2. Delay Impact
**Before:**
- 延遲只傳播到一條路徑
- 漏算部分影響

**After:**
- 延遲傳播到所有路徑
- 完整的影響分析

### 3. Critical Path
**Before:**
- 錯誤的關鍵路徑計算
- 錯誤的浮動時間

**After:**
- 正確的關鍵路徑
- 準確的浮動時間

### 4. Diagram
**Before:**
- 缺少依賴箭頭
- 不完整的依賴圖

**After:**
- 所有依賴箭頭顯示
- 完整的依賴關係圖

## 測試案例

### 測試 1: 多依賴任務
```typescript
const task = {
  name: "Task C",
  dependencies: ["task-a", "task-b", "task-c"]
};

// 應該在所有前置任務完成後才能開始
// 最早開始 = max(Task A finish, Task B finish, Task C finish)
```

### 測試 2: 延遲傳播
```typescript
// Task A 延遲 2 天
// Task C 依賴 Task A 和 Task B
// 應該檢測到 Task C 也會延遲

delayImpact("task-a", 2);
// 應該包含 Task C 在受影響任務中
```

### 測試 3: 關鍵路徑
```typescript
// Task C 有多個前置任務
// 關鍵路徑應該考慮所有路徑
// 最長路徑決定關鍵路徑
```

## 驗證步驟

1. **刷新瀏覽器**
   ```
   Ctrl + Shift + R
   ```

2. **創建多依賴任務**
   ```
   task "Task A" { ... }
   task "Task B" { ... }
   task "Task C" {
     depends: "Task A"
     depends: "Task B"
   }
   ```

3. **測試功能**
   - Auto-schedule: Task C 應該在 A 和 B 都完成後開始
   - Delay impact: 延遲 A 或 B 都應該影響 C
   - Critical path: 應該包含所有依賴關係
   - Diagram: 應該顯示兩條箭頭指向 C

## 部署狀態

```
Commit: 21685c53
Build: 進行中
Status: Critical fix
```

## 教訓

**永遠使用 push() 添加數組元素，不要覆蓋！**

```typescript
// ❌ 錯誤
arr = [newItem];

// ✅ 正確
arr.push(newItem);
```

---

**這是一個嚴重的 bug，影響所有依賴相關功能！**

**現在已修復！** ✅
