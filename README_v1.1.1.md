# Homie Butler v1.1.1 Beta

本版已接好：
- 家庭 PIN + Neon 雲端同步
- 裝置綁定家庭成員
- 今日流程／每日維持／彈性家事都可完成
- 完成時可填備註
- 完成照片先在手機壓縮，再上傳至 Private Vercel Blob
- 私密照片透過 `/api/photo` + 家庭 PIN 讀取，不公開 Blob URL
- 管理者可將每日流程／每日維持「只從今天移除」
- 今日提醒可由管理者刪除
- 獨立即時中 ⇄ 印尼翻譯頁

GitHub 要放：
index.html
package.json
api/state.js
api/upload.js
api/photo.js
api/translate.js

目前翻譯功能仍需要另外設定 OPENAI_API_KEY；沒有設定時，不影響其餘家事功能。
