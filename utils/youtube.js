// YouTube — بدون API Key
// يستخدم: صفحة الـ HTML لاستخراج معلومات القناة + RSS Feed للفيديوهات
const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

// تطبيع رابط YouTube إلى رابط قانوني
function normalizeUrl(raw) {
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  const url = new URL(raw);
  // youtu.be/ID → youtube.com/watch?v=ID
  if (url.hostname === 'youtu.be') return 'https://www.youtube.com/watch?v=' + url.pathname.slice(1);
  if (!url.hostname.includes('youtube')) return null;
  return url.href;
}

// استخراج معرف القناة من HTML صفحة YouTube
function extractChannelId(html) {
  for (const rx of [
    /"channelId":"(UC[\w-]{22})"/,
    /"externalId":"(UC[\w-]{22})"/,
    /channel\/(UC[\w-]{22})/,
    /"browseId":"(UC[\w-]{22})"/
  ]) {
    const m = html.match(rx);
    if (m) return m[1];
  }
  return null;
}

// بناء رابط صفحة القناة من أنواع روابط YouTube المختلفة
function buildChannelPageUrl(rawUrl) {
  try {
    const url = new URL(normalizeUrl(rawUrl) || rawUrl);
    const p   = url.pathname;
    // /channel/UC...
    if (p.startsWith('/channel/')) return 'https://www.youtube.com' + p;
    // /@handle  /c/name  /user/name
    if (p.startsWith('/@') || p.startsWith('/c/') || p.startsWith('/user/')) return 'https://www.youtube.com' + p;
    // /watch?v= → من صفحة الفيديو نجيب القناة
    if (p === '/watch') return rawUrl;
    // اسم مجرد مثل PewDiePie
    return 'https://www.youtube.com/@' + p.replace(/^\//, '');
  } catch { return rawUrl; }
}

async function searchByUrl(rawUrl) {
  const pageUrl = buildChannelPageUrl(rawUrl);

  let html;
  try {
    const res = await axios.get(pageUrl, { headers: HEADERS, timeout: 15000 });
    html = res.data;
  } catch (err) {
    throw new Error('فشل تحميل صفحة YouTube: ' + err.message);
  }

  const channelId = extractChannelId(html);
  if (!channelId) throw new Error('تعذّر استخراج معرف القناة. تأكد من صحة الرابط.');

  // اسم القناة
  const nameMatch = html.match(/"channelMetadataRenderer":\{"title":"([^"]+)"/)
                 || html.match(/"title":"([^"]+)","description":"[^"]*","rssUrl"/);
  const name = nameMatch ? nameMatch[1] : 'YouTube Channel';

  // الصورة
  const imgMatch = html.match(/"avatar":\{"thumbnails":\[\{"url":"(https:\/\/yt3[^"]+)"/)
                || html.match(/"thumbnails":\[\{"url":"(https:\/\/yt3[^"]+)","width":88/);
  const image = imgMatch ? imgMatch[1].replace(/=s\d+-/, '=s240-') : null;

  // الوصف
  const descMatch = html.match(/"description":"((?:[^"\\]|\\.)*)","rssUrl"/);
  const description = descMatch ? descMatch[1].replace(/\\n/g, ' ').slice(0, 200) : '';

  // عدد المشتركين
  const subsMatch = html.match(/"subscriberCountText":\{"simpleText":"([^"]+)"/)
                 || html.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"/);
  const subscribers = subsMatch ? subsMatch[1] : null;

  return {
    id: channelId,
    name,
    description,
    image,
    subscribers,
    slug: channelId,
    url: `https://www.youtube.com/channel/${channelId}`
  };
}

// جلب أحدث فيديو عبر RSS — لا يحتاج أي API
async function getLatestVideo(channelId) {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  let xml;
  try {
    const res = await axios.get(rssUrl, { headers: HEADERS, timeout: 12000 });
    xml = res.data;
  } catch (err) {
    throw new Error('فشل تحميل RSS: ' + err.message);
  }

  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g);
  if (!entries?.length) return null;

  const e = entries[0];
  const videoId    = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
  const title      = e.match(/<title>([^<]+)<\/title>/)?.[1] || 'بدون عنوان';
  const published  = e.match(/<published>([^<]+)<\/published>/)?.[1] || null;
  const thumbnail  = e.match(/<media:thumbnail url="([^"]+)"/)?.[1] || null;
  const channelName = e.match(/<name>([^<]+)<\/name>/)?.[1] || '';

  if (!videoId) return null;

  return {
    id: videoId,
    title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'),
    thumbnail,
    channelName,
    publishedAt: published,
    url: `https://www.youtube.com/watch?v=${videoId}`
  };
}

module.exports = { searchByUrl, getLatestVideo };
