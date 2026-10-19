# Homie Butler 1.2.21 — 雙家庭試行版

## 上線前
1. **先備份 Neon 資料庫**，至少備份 `homie_state` 的 `id=1` 那筆完整 JSON 和 revision。若可行請建立 Neon branch。
2. Vercel Project → Settings → Environment Variables → 新增 `HOMIE_SISTER_PIN`，填入**與原 HOMIE_FAMILY_PIN 不同**的六位數 PIN；勾選 Production。不要把 PIN 寫在 GitHub。
3. 部署此 ZIP 的內容到 GitHub main（保留原有環境變數），確認 Vercel 部署成功。
4. **先用原 PIN 登入**，確認既有家庭資料、完成照片及家事紀錄均存在。
5. **使用無痕視窗或姐姐自己的手機**，輸入新 PIN，建立姐姐家空白資料。新家庭預設成員為「姐姐（管理者）」「外傭（家庭助手）」，沒有預載妳家的工作或固定流程。
6. 兩個家庭各自新增一個工作、上傳測試照片，確認無法跨家庭查看對方照片。再確認原家庭資料不變。

## 技術與限制
- Neon 原有 `homie_state.id=1` 不遷移、不覆蓋；姐姐家使用同一表的 `id=2`，並沿用 revision 衝突檢查。
- 上傳照片使用 `homie/completions/`（原家庭）或 `homie/sister/completions/`（姐姐家），讀取時核對 PIN 對應路徑。
- 兩家共用網址及後端 API，但家事狀態與照片分開。
- **PIN 是家庭共用密碼，不是個人權限憑證**。原版「選擇成員」只影響介面角色，並非伺服器端逐人權限控管。需要強身分驗證時應再升級帳號登入。
- LINE 群組翻譯仍為原本的單一 LINE Bot，與家庭 PIN 無關；此次只修正文字翻譯可能被 `__IGNORE__` 靜默略過的問題。
- 動態重新計算自動家事，不再依賴舊的 `S.planned[date]` 快取；手動加入／排除工作仍會保留。
- 不含真實 Neon / Vercel / LINE 整合測試；請依上面步驟先驗證再正式讓姐姐使用。
