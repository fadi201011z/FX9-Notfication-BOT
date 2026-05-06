# 🤖 Discord Bot — YouTube • Kick • Twitter

بوت ديسكورد احترافي — **لا يحتاج أي API Key** لأي منصة.

---

## ✅ المتطلبات

- **Node.js v22 أو أحدث** — [nodejs.org](https://nodejs.org) (اختر LTS)

```bash
node --version   # يجب أن يظهر v22 أو أعلى
```

---

## 🚀 التشغيل خطوة بخطوة

### 1. فك الضغط وافتح المجلد

### 2. إعداد ملف البيئة
```bash
copy .env.example .env
```
افتح `.env` وأضف فقط:
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`

### 3. تثبيت المكتبات
```bash
npm install
```

### 4. تسجيل الأوامر (مرة واحدة فقط)
```bash
npm run deploy
```

### 5. تشغيل البوت
```bash
npm start
```

---

## 🔑 Discord Token فقط — كيف تحصل عليه

1. [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. **Bot → Reset Token** → انسخ التوكن → `DISCORD_TOKEN`
3. **General Information → Application ID** → `DISCORD_CLIENT_ID`
4. فعّل في Bot:  ✅ Server Members Intent  ✅ Message Content Intent
5. **OAuth2 → URL Generator** → `bot` + `applications.commands` → `Administrator` → ادعُ البوت للسيرفر

---

## ⚙️ الإعداد داخل ديسكورد

```
/setlogchannel channel:#logs
/setchannel platform:YouTube  channel:#youtube-notifs
/setchannel platform:Kick     channel:#kick-notifs
/setchannel platform:Twitter  channel:#twitter-notifs
```

---

## 🔗 ربط القنوات

```
/link url: https://youtube.com/@channelname
/link url: https://kick.com/username
/link url: https://twitter.com/username
```

---

## 🧪 تجربة الإشعارات

```
/test platform:YouTube
/test platform:Kick
/test platform:Twitter
```

يرسل إشعاراً حقيقياً إلى الروم المحدد لتأكيد أن كل شيء يعمل.

---

## 📋 الأوامر

| الأمر | الوصف |
|-------|-------|
| `/link url:` | ربط قناة عبر الرابط (بدون API) |
| `/test platform:` | إرسال إشعار تجريبي للروم |
| `/setchannel` | تحديد روم الإشعارات |
| `/setlogchannel` | تحديد روم السجلات |
| `/setroles` | تحديد الصلاحيات |
| `/add` | نشر إعلان |
| `/autoreply` | الردود التلقائية |
| `/reminder` | التذكيرات |

---

## ❓ حل المشاكل

| المشكلة | الحل |
|---------|------|
| `Cannot find module 'node:sqlite'` | حدّث Node.js إلى v22+ |
| `Invalid Token` | تأكد من `DISCORD_TOKEN` في `.env` |
| الأوامر لا تظهر | شغّل `npm run deploy` أولاً |
| `/test` يفشل على Twitter | الـ Nitter قد يكون بطيئاً، جرّب مرة أخرى |
| YouTube لا يجد القناة | تأكد من الرابط، مثال: `https://youtube.com/@name` |

---

## 💡 تشغيل 24/7

```bash
npm install -g pm2
pm2 start index.js --name discord-bot
pm2 save && pm2 startup
```
