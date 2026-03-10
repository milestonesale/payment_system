# 會員繳費管理系統 - 規格說明

## 1. 功能概述

一個供會員上傳入數紙、管理員後台審核既繳費管理系統。

## 2. 用戶角色

### 會員（前臺）
- 上傳入數紙圖片
- 填寫電話、姓名（可多個別名）
- 選擇活動月份
- 查看自己既繳費狀態

### 管理員（後臺）
- 審核上傳既繳費記錄
- 批准 / 拒絕繳費
- 查看所有會員既繳費歷史
- 導出欠費會員名單（兩期或以上未繳）
- 新增 / 編輯會員資料
- 設定每月費用

## 3. 數據模型

### Member（會員）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | INTEGER | 主鍵 |
| phone | TEXT | 電話（唯一） |
| names | TEXT | JSON array，多個別名 |
| created_at | DATETIME | 創建時間 |
| status | TEXT | active / suspended |

### Payment（繳費記錄）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | INTEGER | 主鍵 |
| member_id | INTEGER | 關聯會員 |
| month | TEXT | 活動月份 (YYYY-MM) |
| amount | INTEGER | 繳費金額 |
| image_url | TEXT | 入數紙圖片 URL |
| status | TEXT | pending / approved / rejected |
| created_at | DATETIME | 提交時間 |
| approved_at | DATETIME | 審核時間 |

### Config（配置）
| 欄位 | 類型 | 說明 |
|------|------|------|
| key | TEXT | 配置鍵 |
| value | TEXT | 配置值 |

## 4. 頁面設計

### 前臺 - 會員上傳頁面
```
┌─────────────────────────────┐
│     [會員繳費系統]          │
├─────────────────────────────┤
│  電話號碼: [____________]    │
│  姓名/別名: [____________]   │
│  活動月份: [2026-03 ▼]      │
│  繳費金額: [____________]    │
│  上傳入數紙: [選擇檔案]      │
│                             │
│      [提交]                 │
└─────────────────────────────┘
```

### 後臺 - 管理員面板
```
┌─────────────────────────────────────────────────┐
│  管理員面板                    [登出]            │
├─────────────────────────────────────────────────┤
│  [待審核 (3)] [所有記錄] [會員管理] [欠費名單]   │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐   │
│  │ 📱 12345678 -張三                       │   │
│  │ 📅 2026-03 | 💰 $300                    │   │
│  │ 🖼️ [入數紙圖片預覽]                     │   │
│  │ [批准] [拒絕] [備註...]                 │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## 5. API 接口

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/payment/submit | 會員提交繳費 |
| GET | /api/payment/status/:phone | 會員查詢自己既繳費狀態 |
| GET | /api/admin/payments | 獲取所有繳費記錄（管理員） |
| POST | /api/admin/payment/:id/approve | 批准繳費 |
| POST | /api/admin/payment/:id/reject | 拒絕繳費 |
| GET | /api/admin/members | 獲取所有會員 |
| POST | /api/admin/member | 新增會員 |
| PUT | /api/admin/member/:id | 編輯會員 |
| GET | /api/admin/overdue | 獲取欠費會員（兩期以上） |
| POST | /api/admin/config | 設定每月費用 |

## 6. 部署

- GitHub: 存放 source code
- Cloudflare Pages: 托管靜態前臺
- Cloudflare Workers: API 後臺
- Cloudflare D1: SQLite 數據庫
- Cloudflare R2: 圖片存儲

## 7. 安全

- 管理員後臺需要密碼登入
- 上傳既圖片需要驗證係圖片格式
- API 需要 basic auth 或 token 驗證

## 8. 免費額度（Cloudflare）

- D1: 每月 100,000 read / 40,000 write queries
- R2: 每月 1,000,000 Class A / 10,000,000 Class B operations
- Workers: 每月 100,000 requests
- Pages: 無限

足夠 300 會員既使用量。
