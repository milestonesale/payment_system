// Cloudflare Workers - 會員繳費管理系統 API

const ADMIN_PASSWORD = "payment_admin_2026"; // 生產環境請改為強密碼
let DB = null;
let R2 = null;

// D1 Database Schema
const SCHEMA = `
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    names TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    amount INTEGER NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
`;

export default {
    async fetch(request, env, ctx) {
        DB = env.DB;
        R2 = env.RECEIPTS;
        
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        
        // CORS
        if (method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }
            });
        }
        
        try {
            // 初始化數據庫（首次部署時）
            if (path === '/api/init' && method === 'POST') {
                await initDB();
                return json({ success: true, message: '數據庫初始化完成' });
            }
            
            // 會員 API
            if (path === '/api/payment/submit' && method === 'POST') {
                return await submitPayment(request);
            }
            
            if (path.startsWith('/api/payment/status/') && method === 'GET') {
                const phone = path.split('/').pop();
                return await getPaymentStatus(phone);
            }
            
            // 管理員 API
            if (path === '/api/admin/login' && method === 'POST') {
                return await adminLogin(request);
            }
            
            // 需要認證的 API
            const auth = request.headers.get('Authorization');
            if (!auth || !auth.startsWith('Bearer ')) {
                return json({ error: '未授權' }, 401);
            }
            const token = auth.replace('Bearer ', '');
            
            if (path === '/api/admin/payments' && method === 'GET') {
                return await getAllPayments(url.searchParams.get('status'));
            }
            
            if (path.match(/^\/api\/admin\/payment\/\d+\/approve$/) && method === 'POST') {
                const id = path.match(/^\/api\/admin\/payment\/(\d+)\/approve$/)[1];
                return await approvePayment(id, token);
            }
            
            if (path.match(/^\/api\/admin\/payment\/\d+\/reject$/) && method === 'POST') {
                const id = path.match(/^\/api\/admin\/payment\/(\d+)\/reject$/)[1];
                return await rejectPayment(id, token);
            }
            
            if (path === '/api/admin/members' && method === 'GET') {
                return await getAllMembers();
            }
            
            if (path === '/api/admin/member' && method === 'POST') {
                return await createMember(request);
            }
            
            if (path.match(/^\/api\/admin\/member\/\d+$/) && method === 'PUT') {
                const id = path.match(/^\/api\/admin\/member\/(\d+)$/)[1];
                return await updateMember(id, request);
            }
            
            if (path === '/api/admin/overdue' && method === 'GET') {
                return await getOverdueMembers();
            }
            
            if (path === '/api/admin/config' && method === 'POST') {
                return await setConfig(request);
            }
            
            if (path.startsWith('/api/admin/config/') && method === 'GET') {
                const key = path.split('/').pop();
                return await getConfig(key);
            }
            
            // 文件上傳
            if (path === '/api/upload' && method === 'POST') {
                return await uploadFile(request);
            }
            
            // 靜態文件
            if (path === '/' || path === '/index.html') {
                return new Response(await getAsset('index.html'), {
                    headers: { 'Content-Type': 'text/html' }
                });
            }
            
            if (path === '/admin' || path === '/admin.html') {
                return new Response(await getAsset('admin.html'), {
                    headers: { 'Content-Type': 'text/html' }
                });
            }
            
            return json({ error: 'Not Found' }, 404);
            
        } catch (err) {
            return json({ error: err.message }, 500);
        }
    }
};

const ASSETS = {
    'index.html': `<!DOCTYPE html>
<html lang="zh-HK">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>會員繳費系統</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6 mt-10">
        <h1 class="text-2xl font-bold text-center text-blue-600 mb-6">會員繳費系統</h1>
        <form id="paymentForm" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">電話號碼</label>
                <input type="tel" id="phone" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例: 61234567">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">姓名 / 別名</label>
                <input type="text" id="name" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例: 張三 / 小明">
                <p class="text-xs text-gray-500 mt-1">如有多个别名，请用逗号分隔</p>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">活動月份</label>
                <input type="month" id="month" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">繳費金額</label>
                <input type="number" id="amount" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例: 300">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">上傳入數紙</label>
                <input type="file" id="receipt" accept="image/*" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <button type="submit" class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium">提交</button>
        </form>
        <div id="status" class="mt-4 hidden"></div>
        <div class="mt-6 pt-6 border-t border-gray-200">
            <h2 class="text-lg font-semibold mb-3">查詢繳費狀態</h2>
            <div class="flex gap-2">
                <input type="tel" id="queryPhone" class="flex-1 px-3 py-2 border border-gray-300 rounded-md" placeholder="輸入電話號碼">
                <button onclick="queryStatus()" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">查詢</button>
            </div>
            <div id="queryResult" class="mt-3 text-sm"></div>
        </div>
    </div>
    <script>
        const API_BASE = '';
        document.getElementById('month').value = new Date().toISOString().slice(0, 7);
        document.getElementById('paymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = document.getElementById('phone').value.trim();
            const name = document.getElementById('name').value.trim();
            const month = document.getElementById('month').value;
            const amount = document.getElementById('amount').value;
            const receipt = document.getElementById('receipt').files[0];
            const statusDiv = document.getElementById('status');
            statusDiv.classList.remove('hidden', 'bg-green-100', 'text-green-700', 'bg-red-100', 'text-red-700');
            statusDiv.classList.add('bg-blue-100', 'text-blue-700');
            statusDiv.textContent = '上傳緊...';
            try {
                const formData = new FormData();
                formData.append('file', receipt);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!uploadRes.ok) throw new Error('上傳圖片失敗');
                const { url } = await uploadRes.json();
                const res = await fetch('/api/payment/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, name, month, amount: parseInt(amount), imageUrl: url })
                });
                if (res.ok) {
                    statusDiv.className = 'mt-4 p-3 bg-green-100 text-green-700 rounded-md';
                    statusDiv.textContent = '✅ 提交成功！請等待審核。';
                    document.getElementById('paymentForm').reset();
                    document.getElementById('month').value = new Date().toISOString().slice(0, 7);
                } else {
                    const data = await res.json();
                    throw new Error(data.message || '提交失敗');
                }
            } catch (err) {
                statusDiv.className = 'mt-4 p-3 bg-red-100 text-red-700 rounded-md';
                statusDiv.textContent = '❌ ' + err.message;
            }
        });
        async function queryStatus() {
            const phone = document.getElementById('queryPhone').value.trim();
            const resultDiv = document.getElementById('queryResult');
            if (!phone) { resultDiv.innerHTML = '<span class="text-red-600">請輸入電話號碼</span>'; return; }
            try {
                const res = await fetch('/api/payment/status/' + phone);
                const data = await res.json();
                if (res.ok) {
                    if (data.payments.length === 0) {
                        resultDiv.innerHTML = '<span class="text-gray-600">沒有找到繳費記錄</span>';
                    } else {
                        resultDiv.innerHTML = data.payments.map(p => {
                            const statusColor = p.status === 'approved' ? 'text-green-600' : p.status === 'rejected' ? 'text-red-600' : 'text-yellow-600';
                            const statusText = p.status === 'approved' ? '✅ 已批准' : p.status === 'rejected' ? '❌ 已拒絕' : '⏳ 審核中';
                            return '<div class="border-b py-2"><div class="flex justify-between"><span>' + p.month + '</span><span class="' + statusColor + '">' + statusText + '</span></div><div class="text-gray-600">$' + p.amount + '</div></div>';
                        }).join('');
                    }
                } else { resultDiv.innerHTML = '<span class="text-red-600">' + data.message + '</span>'; }
            } catch (err) { resultDiv.innerHTML = '<span class="text-red-600">查詢失敗</span>'; }
        }
    </script>
</body>
</html>`
};

async function getAsset(name) {
    return ASSETS[name] || '';
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

async function initDB() {
    const statements = SCHEMA.split(';').filter(s => s.trim());
    for (const stmt of statements) {
        if (stmt.trim()) await DB.prepare(stmt).run();
    }
}

async function submitPayment(request) {
    const { phone, name, month, amount, imageUrl } = await request.json();
    
    if (!phone || !month || !amount) {
        return json({ message: '缺少必要資料' }, 400);
    }
    
    // 搵會員或創建新會員
    let member = await DB.prepare('SELECT * FROM members WHERE phone = ?').bind(phone).first();
    
    if (!member) {
        // 創建新會員
        const result = await DB.prepare(
            'INSERT INTO members (phone, names) VALUES (?, ?)'
        ).bind(phone, name).run();
        member = { id: result.lastInsertRowid, phone, names: name };
    } else {
        // 更新 names 如果有提供
        if (name && name !== member.names) {
            await DB.prepare('UPDATE members SET names = ? WHERE id = ?').bind(name, member.id).run();
        }
    }
    
    // 創建繳費記錄
    await DB.prepare(
        'INSERT INTO payments (member_id, month, amount, image_url, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(member.id, month, amount, imageUrl || null, 'pending').run();
    
    return json({ success: true, message: '提交成功' });
}

async function getPaymentStatus(phone) {
    const member = await DB.prepare('SELECT * FROM members WHERE phone = ?').bind(phone).first();
    
    if (!member) {
        return json({ payments: [] });
    }
    
    const payments = await DB.prepare(`
        SELECT month, amount, status FROM payments 
        WHERE member_id = ? ORDER BY created_at DESC
    `).bind(member.id).all();
    
    return json({ 
        member: { phone: member.phone, names: member.names },
        payments: payments.results 
    });
}

async function adminLogin(request) {
    const { password } = await request.json();
    
    if (password !== ADMIN_PASSWORD) {
        return json({ message: '密碼錯誤' }, 401);
    }
    
    // 簡單既 token（生產環境應用 JWT）
    const token = btoa(ADMIN_PASSWORD + ':' + Date.now());
    
    return json({ token });
}

async function getAllPayments(status = null) {
    let query = `
        SELECT p.*, m.phone, m.names FROM payments p
        JOIN members m ON p.member_id = m.id
        ORDER BY p.created_at DESC
    `;
    
    let bindings = [];
    if (status) {
        query = `
            SELECT p.*, m.phone, m.names FROM payments p
            JOIN members m ON p.member_id = m.id
            WHERE p.status = ?
            ORDER BY p.created_at DESC
        `;
        bindings = [status];
    }
    
    const payments = await DB.prepare(query).bind(...bindings).all();
    return json({ payments: payments.results });
}

async function approvePayment(id, token) {
    await DB.prepare(
        "UPDATE payments SET status = 'approved', approved_at = datetime('now') WHERE id = ?"
    ).bind(id).run();
    return json({ success: true });
}

async function rejectPayment(id, token) {
    await DB.prepare(
        "UPDATE payments SET status = 'rejected' WHERE id = ?"
    ).bind(id).run();
    return json({ success: true });
}

async function getAllMembers() {
    const members = await DB.prepare('SELECT * FROM members ORDER BY created_at DESC').all();
    return json({ members: members.results });
}

async function createMember(request) {
    const { phone, names, status } = await request.json();
    
    try {
        const result = await DB.prepare(
            'INSERT INTO members (phone, names, status) VALUES (?, ?, ?)'
        ).bind(phone, names, status || 'active').run();
        
        return json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        return json({ message: '電話號碼已存在' }, 400);
    }
}

async function updateMember(id, request) {
    const { phone, names, status } = await request.json();
    
    await DB.prepare(
        'UPDATE members SET phone = ?, names = ?, status = ? WHERE id = ?'
    ).bind(phone, names, status, id).run();
    
    return json({ success: true });
}

async function getOverdueMembers() {
    // 搵欠費兩期或以上既會員
    const members = await DB.prepare(`
        SELECT m.id, m.phone, m.names, m.status,
            (SELECT COUNT(DISTINCT p2.month) FROM payments p2 
             WHERE p2.member_id = m.id AND p2.status = 'approved') as paid_months
        FROM members m
        WHERE m.status = 'active'
    `).all();
    
    // 假設最近6個月有繳費記錄既先計
    const currentMonth = new Date().getMonth();
    const monthsToCheck = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthsToCheck.push(d.toISOString().slice(0, 7));
    }
    
    const overdue = [];
    for (const m of members.results) {
        const paid = await DB.prepare(`
            SELECT month FROM payments 
            WHERE member_id = ? AND status = 'approved' AND month IN (${monthsToCheck.map(() => '?').join(',')})
        `).bind(m.id, ...monthsToCheck).all();
        
        const paidMonths = new Set(paid.results.map(p => p.month));
        const unpaidMonths = monthsToCheck.filter(m => !paidMonths.has(m));
        
        if (unpaidMonths.length >= 2) {
            overdue.push({
                phone: m.phone,
                names: m.names,
                overdue_count: unpaidMonths.length,
                overdue_months: unpaidMonths
            });
        }
    }
    
    return json({ members: overdue });
}

async function setConfig(request) {
    const { key, value } = await request.json();
    
    await DB.prepare(
        'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)'
    ).bind(key, value).run();
    
    return json({ success: true });
}

async function getConfig(key) {
    const result = await DB.prepare('SELECT * FROM config WHERE key = ?').bind(key).first();
    return json(result || { value: null });
}

async function uploadFile(request) {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
        return json({ message: '沒有文件' }, 400);
    }
    
    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
    
    // 如果有 R2
    if (R2) {
        await R2.put(filename, file.stream(), {
            httpMetadata: { contentType: file.type }
        });
        const url = `${new URL(request.url).origin}/receipts/${filename}`;
        return json({ url });
    }
    
    // 無 R2 既話，轉為 base64 存係數據庫（細既圖先適用）
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const dataUrl = `data:${file.type};base64,${base64}`;
    
    return json({ url: dataUrl });
}
