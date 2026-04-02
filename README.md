# Shooter Survivor

第一人稱視角的 FPS 生存射擊遊戲，以 Three.js 製作，無需打包工具，直接在瀏覽器執行。

---

## 快速開始

需要一個本地靜態伺服器（因為 ES module 不能從 `file://` 直接讀取）：

```bash
# 任選其一
npx serve .
python -m http.server 8080
```

開啟後進入 `index.html` 開始遊戲，或進入 `map-editor.html` 使用地圖編輯器。

---

## 操作說明

### 遊戲

| 按鍵 | 功能 |
|------|------|
| WASD | 移動 |
| 滑鼠 | 視角轉動 |
| 左鍵 | 射擊 |
| 1 / 2 / 3 | 切換武器槽 |
| R | 換彈 |
| E | 撿起附近武器掉落物 |
| F | 主動技能（手榴彈） |
| Tab | 平衡調整選單 |
| ` （反引號） | Debug 作弊選單 |

### 地圖編輯器

| 按鍵 / 操作 | 功能 |
|-------------|------|
| 1 | 工具：Box（牆/箱體） |
| 2 | 工具：Pillar（柱子） |
| 3 | 工具：Platform（平台） |
| S | 工具：放置 Spawn Point |
| R | 工具：放置 Resource Node |
| P | 工具：放置 Player Start |
| E | 工具：Erase |
| 左鍵拖曳 | 繪製物件 |
| 右鍵 | 快速刪除 |
| Alt + 拖曳 | 平移視圖 |
| 滾輪 | 縮放視圖 |
| Delete | 刪除選中物件 |
| 3D 預覽左鍵拖曳 | 旋轉視角 |
| 3D 預覽右鍵拖曳 / 滾輪 | 縮放 |

---

## 角色

| 角色 | HP | 護甲 | 起始武器 | 被動 | 主動技能 |
|------|----|------|----------|------|----------|
| **RANGER** | 150 | 50 | 霰彈槍 / 火箭筒 | 連殺 3 次後下一槍雙倍傷害 | 手榴彈（冷卻 8s） |
| **SOLDIER** | 180 | 75 | 機槍 / 釘槍 | 護甲吸收 80% 傷害 | 手榴彈（冷卻 8s） |

---

## 武器

| 武器 | 類型 | 傷害 | 彈匣 | 備彈 | 特性 |
|------|------|------|------|------|------|
| 霰彈槍 | 即時判定 | 15×7 顆 | 8 | 64 | 散射 |
| 火箭筒 | 投射物 | 80 直擊 + 60 爆炸 | 4 | 20 | 爆炸範圍傷害 |
| 機槍 | 即時判定 | 12 | 35 | 140 | 高射速 |
| 釘槍 | 投射物 | 45 | 20 | 80 | 中速投射 |
| Railgun | 即時判定 | 120 | 5 | 30 | 穿透所有敵人 |
| 拳套 | 近戰 | 80 | — | — | 僅能透過掉落物取得 |

> 武器槽最多 3 個。地上的武器掉落物 60 秒後消失；撿起時若槽位已滿，當前武器會自動掉到地上。

---

## 資源點與掉落物

- 地圖四個角各有一個資源點，每 **2 分鐘**重生一次
- 重生時隨機掉落：HP 回復 / 護甲 / 彈藥 / 武器
- 敵人死亡也可能掉落補給

---

## 升級系統

每波敵人清除後可選擇一項升級：

- **Max HP** — 增加最大生命值
- **Max Armor** — 增加最大護甲
- **Damage** — 全武器傷害倍率
- **Reload Speed** — 換彈速度
- **Lifesteal** — 每次命中回血

---

## 平衡調整選單（Tab）

可即時調整所有角色、武器、敵人的數值。設定會自動存入 `localStorage`，下次開啟自動載入。

---

## 地圖編輯器

開啟 `map-editor.html`，在 2D 俯視圖上拖曳繪製場景物件，右側即時顯示 3D 預覽。完成後點 **Export JSON** 儲存地圖檔。

地圖 JSON 格式：

```json
{
  "name": "My Map",
  "width": 60,
  "depth": 60,
  "wallHeight": 6,
  "objects": [
    { "type": "box", "x": 10, "y": 3, "z": 5, "w": 4, "h": 6, "d": 2, "mat": "wall" }
  ],
  "spawnPoints":   [ { "x": -20, "z": -20 } ],
  "resourceNodes": [ { "x": 25, "z": 25 } ],
  "playerStart":   { "x": 0, "z": 0 }
}
```

---

## 專案結構

```
shooter_survivor/
├── index.html              # 遊戲主入口
├── map-editor.html         # 地圖編輯器入口
├── vendor/
│   └── three.module.js     # Three.js r162（離線版）
└── src/
    ├── main.js             # 遊戲主迴圈與狀態機
    ├── player.js           # 玩家移動、射擊、武器管理
    ├── characters.js       # 角色定義
    ├── weapons.js          # 武器定義與 WeaponState
    ├── enemies.js          # 敵人 AI、WaveManager、ENEMY_DEFS
    ├── level/
    │   ├── IMapBuilder.js      # 介面定義
    │   ├── FixedArena.js       # 預設固定地圖
    │   └── JsonMapBuilder.js   # 從 JSON 建構地圖
    ├── systems/
    │   ├── CollisionSystem.js  # AABB 碰撞解析
    │   ├── ProjectileSystem.js # 通用投射物
    │   ├── GrenadeSystem.js    # 手榴彈拋物線與爆炸
    │   ├── DropSystem.js       # 掉落物生命週期
    │   ├── ResourceNodes.js    # 資源點重生
    │   └── SaveSystem.js       # localStorage 高分與設定
    ├── ui/
    │   ├── HUD.js              # 遊戲內 HUD
    │   ├── CharacterSelect.js  # 角色選擇畫面
    │   ├── UpgradeMenu.js      # 升級選單
    │   ├── BalanceMenu.js      # 平衡調整面板
    │   └── DebugMenu.js        # Debug 作弊選單
    ├── map-editor/
    │   ├── EditorState.js      # 編輯器狀態（Observer 模式）
    │   ├── GridView.js         # 2D 俯視編輯畫布
    │   ├── Preview3D.js        # 即時 3D 預覽
    │   └── editor-main.js      # 編輯器進入點
    └── utils/
        ├── PlaceholderTextures.js  # Canvas 生成佔位材質
        └── BillboardSprite.js      # Billboard sprite 輔助
```

---

## 技術細節

- **渲染**：Three.js r162，ES modules，importmap 對應本地 vendor 檔案，不依賴 CDN
- **碰撞**：手動 AABB，分軸解析，支援 0.5m step-up 自動登台階
- **射擊判定**：手動 ray vs AABB（不依賴 Three.js Raycaster）
- **存檔**：`localStorage`，key 前綴 `shooter_survivor_`
