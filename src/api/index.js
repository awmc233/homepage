// import axios from "axios";
import fetchJsonp from "fetch-jsonp";

/**
 * 通用工具
 */

// 判断高德接口调用是否成功
export const isAmapSuccess = (data) =>
  !!data && data.status === "1" && data.infocode === "10000";

// 高德在「无数据」时会把字符串字段返回成空数组 []，这里统一成字符串或 null
export const toText = (value) =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

/**
 * 音乐播放器
 */

// 音乐 API 基址
// - 生产环境：与站点同源的 /api，由 nginx 反向代理到 Meting-API（http://127.0.0.1:3000）
// - 也可以填写完整的 https 地址，例如 Deno Deploy 的部署地址
const SONG_API = (import.meta.env.VITE_SONG_API || "/api").replace(/\/+$/, "");

// Meting-API 返回歌单时，会把每首歌的 url / pic / lrc 替换成「它自己」的绝对地址，
// 例如 http://43.143.242.186:3000/api?server=netease&type=url&id=xxx。
// 站点是 https 时，这类 http 地址会被浏览器当作混合内容直接拦截
//（pnpm dev 跑在 http://localhost 上，所以本地看不出问题）。
// 这里统一把它们改写成配置的 API 基址，其余 http 资源在 https 页面下升级为 https。
const toMediaUrl = (raw) => {
  if (!raw) return raw;

  let url;
  try {
    url = new URL(raw, window.location.origin);
  } catch {
    return raw;
  }

  // 形如 ?server=xxx&type=url|pic|lrc&id=xxx 的地址一定来自 Meting-API 自身
  if (url.searchParams.has("server") && url.searchParams.has("type")) {
    return `${SONG_API}${url.search}`;
  }

  // 网易云 CDN 等外部资源同时支持 https，https 页面下不能再用 http
  if (url.protocol === "http:" && window.location.protocol === "https:") {
    url.protocol = "https:";
  }
  return url.href;
};

// 获取音乐播放列表
export const getPlayerList = async (server, type, id) => {
  const res = await fetch(`${SONG_API}?server=${server}&type=${type}&id=${id}`);
  if (!res.ok) {
    throw new Error(`音乐接口请求失败：HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("音乐接口没有返回歌曲");
  }

  // QQ 音乐（OVERSEAS=1）返回的 url 为 @handle@callback@func@url，需要再走一次 jsonp
  if (typeof data[0].url === "string" && data[0].url.startsWith("@")) {
    // eslint-disable-next-line no-unused-vars
    const [handle, jsonpCallback, jsonpCallbackFunction, url] = data[0].url.split("@").slice(1);
    const jsonpData = await fetchJsonp(url).then((r) => r.json());
    const domain = (
      jsonpData.req_0.data.sip.find((i) => !i.startsWith("http://ws")) ||
      jsonpData.req_0.data.sip[0]
    ).replace("http://", "https://");

    return data.map((v, i) => ({
      name: v.name || v.title,
      artist: v.artist || v.author,
      url: domain + jsonpData.req_0.data.midurlinfo[i].purl,
      cover: toMediaUrl(v.cover || v.pic),
      lrc: toMediaUrl(v.lrc),
    }));
  }

  return data.map((v) => ({
    name: v.name || v.title,
    artist: v.artist || v.author,
    url: toMediaUrl(v.url),
    cover: toMediaUrl(v.cover || v.pic),
    lrc: toMediaUrl(v.lrc),
  }));
};

/**
 * 一言
 */

// 获取一言数据
export const getHitokoto = async () => {
  const res = await fetch("https://v1.hitokoto.cn");
  return await res.json();
};

/**
 * 天气
 */

// 获取高德地理位置信息（IP 定位）
// 注意：该接口不支持 IPv6，走 IPv6 时会返回 infocode 10000，但 adcode 为空数组
export const getAdcode = async (key) => {
  const res = await fetch(`https://restapi.amap.com/v3/ip?key=${key}`);
  return await res.json();
};

// 按城市名 / adcode 查询行政区信息（用于兜底城市）
export const getDistrict = async (key, keywords) => {
  const res = await fetch(
    `https://restapi.amap.com/v3/config/district?key=${key}&keywords=${encodeURIComponent(
      keywords,
    )}&subdistrict=0`,
  );
  return await res.json();
};

// 逆地理编码：经纬度 -> 行政区（用于浏览器定位）
export const getRegeo = async (key, location) => {
  const res = await fetch(
    `https://restapi.amap.com/v3/geocode/regeo?key=${key}&location=${location}`,
  );
  return await res.json();
};

// 获取高德地理天气信息
// city 支持 adcode / citycode / 城市名，不支持经纬度
export const getWeather = async (key, city) => {
  if (!city) throw new Error("缺少城市编码（adcode）");
  const res = await fetch(
    `https://restapi.amap.com/v3/weather/weatherInfo?key=${key}&city=${encodeURIComponent(city)}`,
  );
  return await res.json();
};

// 获取教书先生天气 API
// https://api.oioweb.cn/doc/weather/GetWeather
export const getOtherWeather = async () => {
  const res = await fetch("https://api.oioweb.cn/api/weather/GetWeather");
  return await res.json();
};
