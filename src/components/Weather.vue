<template>
  <div class="weather" v-if="weatherData.adCode.city && weatherData.weather.weather">
    <span>{{ weatherData.adCode.city }}&nbsp;</span>
    <span>{{ weatherData.weather.weather }}&nbsp;</span>
    <span>{{ weatherData.weather.temperature }}℃</span>
    <span class="sm-hidden">
      &nbsp;{{
        weatherData.weather.winddirection?.endsWith("风")
          ? weatherData.weather.winddirection
          : weatherData.weather.winddirection + "风"
      }}&nbsp;
    </span>
    <span class="sm-hidden">{{ weatherData.weather.windpower }}&nbsp;级</span>
  </div>
  <div class="weather" v-else>
    <span>天气数据获取失败</span>
  </div>
</template>

<script setup>
import {
  getAdcode,
  getWeather,
  getOtherWeather,
  getDistrict,
  getRegeo,
  isAmapSuccess,
  toText,
} from "@/api";
import { Error } from "@icon-park/vue-next";

// 高德开发者 Key
const mainKey = import.meta.env.VITE_WEATHER_KEY;
// 兜底城市（可填 adcode 或城市名，留空则不启用）
const fallbackCity = toText(import.meta.env.VITE_WEATHER_CITY);

// 天气数据
const weatherData = reactive({
  adCode: {
    city: null, // 城市
    adcode: null, // 城市编码
  },
  weather: {
    weather: null, // 天气现象
    temperature: null, // 实时气温
    winddirection: null, // 风向描述
    windpower: null, // 风力级别
  },
});

// 根据 adcode 查询实时天气，并校验返回数据
const fetchWeather = async (adcode) => {
  const result = await getWeather(mainKey, adcode);
  if (!isAmapSuccess(result) || !Array.isArray(result.lives) || !result.lives[0]) {
    throw new Error(`天气接口未返回数据（city=${adcode}）`);
  }
  return result.lives[0];
};

// 方案一：高德 IP 定位
// 该接口不支持 IPv6，返回 infocode 10000 但 adcode 为 [] 时必须判定为失败
const locateByIp = async () => {
  const result = await getAdcode(mainKey);
  const adcode = toText(result?.adcode);
  if (!isAmapSuccess(result) || !/^\d{6}$/.test(adcode)) {
    console.warn("高德 IP 定位未返回有效城市（IPv6 / 代理 / 境外 IP 时常见）", result);
    return null;
  }
  const city = toText(result.city) || toText(result.province) || "未知地区";
  return { adcode, city, live: await fetchWeather(adcode) };
};

// 方案二：浏览器定位（仅在用户此前已授权时使用，避免首页弹出授权框）
const locateByBrowser = async () => {
  if (!navigator.geolocation || !navigator.permissions?.query) return null;
  const permission = await navigator.permissions.query({ name: "geolocation" });
  if (permission.state !== "granted") return null;

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
  });
  const { longitude, latitude } = position.coords;
  const result = await getRegeo(mainKey, `${longitude},${latitude}`);
  const component = result?.regeocode?.addressComponent;
  const adcode = toText(component?.adcode);
  if (!isAmapSuccess(result) || !/^\d{6}$/.test(adcode)) return null;
  const city = toText(component.city) || toText(component.province) || "未知地区";
  return { adcode, city, live: await fetchWeather(adcode) };
};

// 方案三：使用 .env 中配置的兜底城市
const locateByFallback = async () => {
  if (!fallbackCity) return null;
  let adcode = /^\d{6}$/.test(fallbackCity) ? fallbackCity : null;
  let city = null;

  if (!adcode) {
    const result = await getDistrict(mainKey, fallbackCity);
    const district = result?.districts?.[0];
    adcode = toText(district?.adcode);
    city = toText(district?.name);
    if (!isAmapSuccess(result) || !/^\d{6}$/.test(adcode)) {
      console.warn("兜底城市解析失败", fallbackCity, result);
      return null;
    }
  }
  return { adcode, city, live: await fetchWeather(adcode) };
};

// 获取天气数据（依次尝试 IP 定位 → 浏览器定位 → 兜底城市）
const getWeatherData = async () => {
  try {
    // 未配置 Key 时使用备用天气接口
    if (!mainKey) {
      console.log("未配置，使用备用天气接口");
      const result = await getOtherWeather();
      const data = result.result;
      weatherData.adCode = {
        city: data.city.city_name || "未知地区",
      };
      weatherData.weather = {
        weather: data.condition.condition,
        temperature: data.condition.temp,
        winddirection: data.condition.windDir,
        windpower: data.condition.windLevel,
      };
      return;
    }

    let located = null;
    for (const strategy of [locateByIp, locateByBrowser, locateByFallback]) {
      try {
        located = await strategy();
      } catch (error) {
        console.warn("天气定位方案失败，尝试下一种：", error);
      }
      if (located) break;
    }

    if (!located) {
      throw new Error("所有定位方案均失败（IP 定位 / 浏览器定位 / 兜底城市）");
    }

    const live = located.live;
    weatherData.adCode = {
      // 城市名优先用定位结果，定位结果缺失时取天气接口返回的城市 / 省份
      city: located.city || toText(live.city) || toText(live.province) || "未知地区",
      adcode: located.adcode,
    };
    weatherData.weather = {
      weather: live.weather,
      temperature: live.temperature,
      winddirection: live.winddirection,
      windpower: live.windpower,
    };
  } catch (error) {
    console.error("天气信息获取失败:" + error);
    onError("天气信息获取失败");
  }
};

// 报错信息
const onError = (message) => {
  ElMessage({
    message,
    icon: h(Error, {
      theme: "filled",
      fill: "#efefef",
    }),
  });
  console.error(message);
};

onMounted(() => {
  // 调用获取天气
  getWeatherData();
});
</script>
