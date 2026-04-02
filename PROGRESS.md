# Shooter Survivor — Development Progress

## Phase 1 — Movement & World ✅
- [x] 修正攝影機高度（EYE_OFFSET = 1.65，直接加在 feet position 上）
- [x] 重寫 `getFloorY`：正確偵測腳下任何平面（含階梯/高台）
- [x] 重寫 `CollisionSystem.resolve()`：分軸獨立測試 + step-up 0.5 自動登台階
- [x] 停用敵人/波次/升級（地圖 + 玩家移動測試模式）
- [x] 加入 debug overlay（位置/速度/onGround 即時顯示）
- [ ] 薄牆穿牆問題（留到地圖重設計時一起解決）

## Phase 2 — Shooting Core ✅
- [x] 改用手動 ray vs AABB 命中判斷（取代不可靠的 Sprite raycast）
- [x] 射擊命中視覺反饋：敵人命中→紅色，打牆→白色
- [x] 槍口火光 sprite（跟隨攝影機方向）
- [x] 敵人 hit flash（短暫變紅）、扣血、死亡移除
- [x] 5 個靜止測試靶，debug overlay 顯示存活數與擊殺數

## Phase 3 — Enemy AI ✅
- [x] 敵人移動追蹤玩家（持續 chase）
- [x] 敵人近戰攻擊玩家（damage + 傷害閃紅 vignette）
- [x] 敵人互相分離（push-apart，不重疊）
- [x] 邊界 clamp（不跑出地圖）
- [x] Billboard sprite 正常顯示與縮放（soldier / rusher 兩種外觀）
- [x] debug overlay 顯示 hp / kills / 存活數

## Phase 4 — Wave & Upgrade ✅
- [x] 波次生成邏輯（trickle spawn，難度隨波次增加）
- [x] 波次結束偵測（allDead + waveCheckCooldown 防重複觸發）
- [x] 升級選單（exitPointerLock 釋放游標，paused flag 停止遊戲邏輯）
- [x] 升級效果套用（hp/armor/damage/reload/lifesteal）
- [x] 遊戲結束畫面（顯示 wave/kills/score，restart reload 頁面）
- [x] Enemy class 抽離至 enemies.js，WaveManager 同檔

## Phase 5 — Characters / Weapons / FX (partial)
- [x] 角色選擇畫面（CharacterSelect.js 接回 main.js startGame 流程）
- [x] Rocket Launcher（慢速投射物 speed=14，可閃避，爆炸範圍傷害+粒子）
- [x] ProjectileSystem 通用化（player/enemy 共用，owner 欄位決定傷害對象）
- [x] 遠程敵人投射物（onEnemyFireProjectile callback 接入 WaveManager）
- [x] 投射物尾跡（Line geometry 跟隨彈頭）
- [x] 玩家武器切換 [1] Shotgun / [2] Rocket，player.weapons[] 陣列
- [x] Railgun（穿透 hitscan + 青色軌跡線，移至 Phase 9 實作）
- [ ] Boss wave 視覺與特殊行為
- [ ] 換彈動畫 HUD 進度條

## Phase 6 — Custom Map System (planned)
- [ ] 獨立地圖編輯器入口（e.g. `map-editor.html`，與遊戲主入口分離）
- [ ] 地圖格式定義：JSON 描述 box/pillar/wall 物件，含碰撞資訊
- [ ] MapLoader：讀取 JSON → 呼叫 `_addBox` 等方法建立場景
- [ ] 取代 FixedArena，讓遊戲主場景改由 JSON 驅動
- [ ] 支援多張地圖，角色選擇後可選地圖

## Phase 7 — Player Active Skills / F Key ✅
- [x] 加入 F 鍵主動技能輸入，與各角色定義綁定（`character.activeSkill`）
- [x] 技能冷卻 UI（HUD 中央下方進度條，顯示剩餘秒數 / READY）
- [x] Ranger 主動技能：投擲手榴彈（見 Phase 8）
- [x] 其他角色主動技能預留介面（`tryUseSkill()` 回傳 `{ skillId, aimRay }`）

## Phase 8 — Ranger Grenade ✅
- [x] 拋物線投射物（GRAVITY = 22，初速 15 + upward +6）
- [x] 手榴彈與牆壁/地板碰撞反彈（最多 2 次，BOUNCE_DAMP 0.45），之後靜止
- [x] 定時引爆（fuseTime 3s），最後 0.8s 閃紅
- [x] 爆炸：splash 傷害對敵人 + 自傷（35%），綠/黃/橘粒子 20 顆
- [x] 手榴彈模型（橄欖綠 Canvas sprite，旋轉動畫，引信黃點）
- [x] Soldier 角色同樣使用手榴彈技能（cooldown 8s）

## Phase 9 — More Weapons ✅
- [x] **拳套（Fists）**：近戰 ray vs AABB，傷害 80，射程 2.4m，只能從掉落物取得
- [x] **機槍（Machine Gun）**：hitscan 速射 11rps，spread 0.045，35/140 彈
- [x] **釘槍（Nail Gun）**：直擊投射物 speed 22，傷害 45，20/80 彈，細長銀色 sprite
- [x] **Railgun**：穿透 hitscan，傷害 120，貫穿所有敵人，青色光束 + 白色外輝光漸出
- [x] 武器切換 HUD 顯示所有槽位圖示（右下角垂直列，含彈藥填充條）
- [x] 各武器獨立彈藥數與換彈時間，WeaponState melee 分支處理
- [x] Soldier 角色：MG + NG、Heavy Armor 被動（80% 護甲吸收）
- [x] 掉落物：60 秒自動消失（最後 5 秒閃爍）、武器需 E 鍵互動拾取
- [x] 地圖四角資源點（2 分鐘重生，隨機掉落 HP/Armor/Ammo/Weapon）
- [x] 武器欄位 3 個，滿了換下當前武器→掉地上

## Phase 10 — Balance Parameter Menu ✅
- [x] Tab 開啟平衡調整面板（三欄：Characters / Weapons / Enemies）
- [x] 可調角色基礎 HP / Armor / 移速 / 傷害倍率 / 換彈倍率
- [x] 可調各武器傷害 / 射速 / 換彈時間 / 彈匣 / 備用彈 / 穿透 / Splash
- [x] 可調各敵人 HP / 速度 / 傷害 / 攻速 / 攻擊距離
- [x] 調整即時套用，重置為預設值按鈕
- [x] **Debug 作弊選單**（反引號 ` 開啟）：生成道具/武器/彈藥到地圖中央、補滿 HP+護甲、補滿彈藥、無敵模式切換

## Phase 11 — Persistence / localStorage ✅
- [x] 高分排行榜存入 localStorage（前 10 名，含角色/波次/擊殺/分數）
- [x] 平衡參數設定持久化（slider 調整後自動儲存，下次啟動自動載入套用）
- [x] 角色選擇畫面顯示該角色最高紀錄（★ BEST: Wave / Kills / Score）
- [x] 遊戲結束畫面顯示 ★ NEW BEST 提示
- [x] 清除存檔按鈕（Balance Menu 內，確認對話框後清除全部）
- [x] Reset All 同時清除 localStorage 中的 balance 設定
