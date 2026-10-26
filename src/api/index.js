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

// 获取音乐播放列表
export const getPlayerList = async (server, type, id) => {
  const res = await fetch(
    `${import.meta.env.VITE_SONG_API}?server=${server}&type=${type}&id=${id}`,
  );
  const data = await res.json();

  if (data[0].url.startsWith("@")) {
    // eslint-disable-next-line no-unused-vars
    const [handle, jsonpCallback, jsonpCallbackFunction, url] = data[0].url.split("@").slice(1);
    const jsonpData = await fetchJsonp(url).then((res) => res.json());
    const domain = (
      jsonpData.req_0.data.sip.find((i) => !i.startsWith("http://ws")) ||
      jsonpData.req_0.data.sip[0]
    ).replace("http://", "https://");

    return data.map((v, i) => ({
      name: v.name || v.title,
      artist: v.artist || v.author,
      url: domain + jsonpData.req_0.data.midurlinfo[i].purl,
      cover: v.cover || v.pic,
      lrc: v.lrc,
    }));
  } else {
    return data.map((v) => ({
      name: v.name || v.title,
      artist: v.artist || v.author,
      url: v.url,
      cover: v.cover || v.pic,
      lrc: v.lrc,
    }));
  }
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
