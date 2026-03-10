# 會員繳費管理系統

一個簡單既會員繳費管理系統，供會員上傳入數紙、管理員後台審核。

## 功能

### 會員（前臺）
- 上傳入數紙圖片
- 填寫電話、姓名
- 選擇活動月份
- 查詢自己既繳費狀態

### 管理員（後臺）
- 密碼登入
- 審核上傳既繳費記錄
- 批准 / 拒絕繳費
- 查看所有會員既繳費歷史
- 新增 / 編輯會員資料
- 導出欠費會員名單
- 設定每月費用

## 部署教學

### 1. 準備 GitHub

1. 去 [GitHub](https://github.com) 創建新 Repository
2. 將呢個 project 既 files push 上去

### 2. 準備 Cloudflare

1. 注冊 [Cloudflare](https://cloudflare.com)
2. 創建 Workers & Pages

### 3. 設定 API Token

1. 去 Cloudflare Dashboard → Profile → API Tokens
2. 創建 Custom Token：
   - Permissions: 
     - D1: Edit
     - Workers: Edit
     - R2: Edit
   - Account Resources: 選擇你既 account
3. 記低呢個 token

### 4. 設定 GitHub Secrets

去 Repository → Settings → Secrets → Actions，添加：

| Secret | 值 |
|--------|-----|
| CLOUDFLARE_API_TOKEN | 你既 API Token |
| CLOUDFLARE_ACCOUNT_ID | 你既 Account ID（係 Cloudflare URL 度） |

### 5. 首次部署

1. push 上 main branch
2. 去 GitHub Actions睇部署狀態
3. 完成後會獲得 Workers URL

### 6. 初始化數據庫

部署完成後，訪問：
```
https://你的workersURL/api/init
```

### 7. 修改密碼

打開 `worker.js`，搵到呢行：
```javascript
const ADMIN_PASSWORD = "payment_admin_2026";
```
改為你自己既密碼。

## 使用方法

### 會員上傳
訪問：`https://你的workersURL/`

### 管理員後臺
訪問：`https://你的workersURL/admin`

## 技術栈

- **前端**: HTML + TailwindCSS
- **後端**: Cloudflare Workers
- **數據庫**: Cloudflare D1 (SQLite)
- **圖片存儲**: Cloudflare R2

## 免費額度

- Workers: 每月 100,000 requests
- D1: 每月 100,000 read / 40,000 write
- R2: 每月 1,000,000 Class A operations
- Pages: 無限

足夠 300 會員使用。

## License

MIT
