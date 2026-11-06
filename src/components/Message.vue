<template>
  <!-- 基本信息 -->
  <div class="message">
    <!-- Logo -->
    <div class="logo">
      <img class="logo-img" :src="siteLogo" alt="logo" />
      <div ref="nameRef" class="name">
        <span ref="greetingRef" class="bg">{{ greeting }}</span>
      </div>
    </div>
    <!-- 简介 -->
    <div class="description cards" @click="changeBox">
      <div class="content">
        <Icon size="16">
          <QuoteLeft />
        </Icon>
        <div class="text">
          <p>{{ descriptionText.hello }}</p>
          <p>{{ descriptionText.text }}</p>
        </div>
        <Icon size="16">
          <QuoteRight />
        </Icon>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Icon } from "@vicons/utils";
import { QuoteLeft, QuoteRight } from "@vicons/fa";
import { Error } from "@icon-park/vue-next";
import { mainStore } from "@/store";
const store = mainStore();

// 主页站点logo
const siteLogo = import.meta.env.VITE_SITE_MAIN_LOGO;

// 主页问候语，按时段分组，每次打开展示其中一个，可按需增删
const greetings = {
  morning: ["Morning", "Hello", "Hi", "Hey", "Howdy", "Welcome", "Greetings"],
  afternoon: ["Afternoon", "Hello", "Hi", "Hey", "Howdy", "Welcome", "Greetings"],
  evening: ["Evening", "Hello", "Hi", "Hey", "Howdy", "Welcome", "Greetings"],
};

// 根据当前时间选择问候语分组，避免晚上还显示 Morning
const getGreetingPool = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return greetings.morning;
  if (hour >= 12 && hour < 18) return greetings.afternoon;
  return greetings.evening;
};

// 随机取一个问候语，并尽量避免和上一次重复
const GREETING_STORAGE_KEY = "home-greeting";
const pickGreeting = () => {
  const pool = getGreetingPool();
  let lastGreeting = "";
  try {
    lastGreeting = localStorage.getItem(GREETING_STORAGE_KEY) || "";
  } catch {
    // 隐私模式下 localStorage 可能不可用，忽略即可
  }
  const candidates = pool.filter((item) => item !== lastGreeting);
  const list = candidates.length ? candidates : pool;
  const word = list[Math.floor(Math.random() * list.length)];
  try {
    localStorage.setItem(GREETING_STORAGE_KEY, word);
  } catch {
    // 忽略存储失败
  }
  return word;
};

const greeting = ref(pickGreeting());
const nameRef = ref(null);
const greetingRef = ref(null);

// Canvas 只创建一次，用来读取当前字体真实的墨迹（笔画）范围
let measureContext = null;
const measureGreeting = (textEl) => {
  if (!measureContext) {
    measureContext = document.createElement("canvas").getContext("2d");
  }
  if (!measureContext) return { metrics: null, hasInk: false };
  const style = getComputedStyle(textEl);
  measureContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const metrics = measureContext.measureText(greeting.value);
  const hasInk =
    Number.isFinite(metrics.actualBoundingBoxAscent) &&
    Number.isFinite(metrics.actualBoundingBoxDescent) &&
    Number.isFinite(metrics.actualBoundingBoxLeft) &&
    Number.isFinite(metrics.actualBoundingBoxRight);
  return { metrics, hasInk };
};

// 不同字体的 ascent/descent 和左右边距都不一样，
// 这里按真实笔画范围把问候语钉在固定的位置，换字体也不会跳动
const alignGreeting = (nameEl, textEl, metrics) => {
  const nameStyle = getComputedStyle(nameEl);
  const nameRect = nameEl.getBoundingClientRect();
  const textRect = textEl.getBoundingClientRect();
  const rawScale = nameRect.width / nameEl.clientWidth;
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;

  // 插入一个 0 尺寸的基线标记，量出与字体无关的基线位置
  const marker = document.createElement("span");
  marker.setAttribute("aria-hidden", "true");
  marker.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline;";
  nameEl.appendChild(marker);
  const markerRect = marker.getBoundingClientRect();
  marker.remove();

  const paddingTop = parseFloat(nameStyle.paddingTop) || 0;
  const paddingBottom = parseFloat(nameStyle.paddingBottom) || 0;
  const paddingLeft = parseFloat(nameStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(nameStyle.paddingRight) || 0;
  const contentWidth = nameEl.clientWidth - paddingLeft - paddingRight;
  const contentHeight = nameEl.clientHeight - paddingTop - paddingBottom;
  if (contentWidth <= 0 || contentHeight <= 0) return;

  const baseline = (markerRect.bottom - nameRect.top) / scale;
  const inkCenterY =
    baseline + (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2;
  // 垂直方向对准 .name（也就是左侧头像）的中线
  const targetY = paddingTop + contentHeight / 2;
  const dy = targetY - inkCenterY;

  const textLeft = (textRect.left - nameRect.left) / scale;
  const inkLeft = textLeft - metrics.actualBoundingBoxLeft;
  let dx;
  const isCentered = nameStyle.textAlign === "center";
  if (isCentered) {
    const inkCenterX =
      inkLeft + (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) / 2;
    const targetX = paddingLeft + contentWidth / 2;
    dx = targetX - inkCenterX;
  } else {
    // 让笔画左边缘从 .name 的内容区左侧开始，忽略字体自带的左边距
    dx = paddingLeft - inkLeft;
  }

  textEl.style.transform = `translate(${dx}px, ${dy}px)`;
};

// 问候语宽度随字数变化，这里按可用宽度等比缩小字号，
// 保证长单词也能完整显示；再用 alignGreeting 对齐位置
const fitGreeting = () => {
  const nameEl = nameRef.value;
  const textEl = greetingRef.value;
  if (!nameEl || !textEl) return;

  // 先恢复样式表里的原始字号和位移，再重新测量
  textEl.style.fontSize = "";
  textEl.style.transform = "";

  const nameStyle = getComputedStyle(nameEl);
  const paddingLeft = parseFloat(nameStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(nameStyle.paddingRight) || 0;
  // 用 clientWidth 而不是 getBoundingClientRect，避免把入场动画的 scale 算进来
  const available = nameEl.clientWidth - paddingLeft - paddingRight;
  // 隐藏状态下（移动端菜单、设置页等）不做处理，同时保留上次的样式
  if (available <= 0) return;

  const baseFontSize = parseFloat(getComputedStyle(textEl).fontSize);
  const minFontSize = Math.min(baseFontSize, 24);
  let fontSize = baseFontSize;
  let { metrics, hasInk } = measureGreeting(textEl);

  // 按真实墨迹宽度缩放，装饰字体也不会被裁掉
  for (let i = 0; i < 4; i++) {
    const inkWidth = hasInk
      ? metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight
      : textEl.offsetWidth;
    if (inkWidth <= available) break;
    fontSize = Math.max(((fontSize * available) / inkWidth) * 0.98, minFontSize);
    textEl.style.fontSize = `${fontSize}px`;
    ({ metrics, hasInk } = measureGreeting(textEl));
    if (fontSize <= minFontSize) break;
  }

  if (hasInk) alignGreeting(nameEl, textEl, metrics);
};

// 简介区域文字
const descriptionText = reactive({
  hello: import.meta.env.VITE_DESC_HELLO,
  text: import.meta.env.VITE_DESC_TEXT,
});

// 切换右侧功能区
const changeBox = () => {
  if (store.getInnerWidth >= 990) {
    store.boxOpenState = !store.boxOpenState;
  } else {
    ElMessage({
      message: "当前页面宽度不足以开启盒子",
      grouping: true,
      icon: h(Error, {
        theme: "filled",
        fill: "#efefef",
      }),
    });
  }
};

// 监听状态变化
watch(
  () => store.boxOpenState,
  (value) => {
    if (value) {
      descriptionText.hello = import.meta.env.VITE_DESC_HELLO_OTHER;
      descriptionText.text = import.meta.env.VITE_DESC_TEXT_OTHER;
    } else {
      descriptionText.hello = import.meta.env.VITE_DESC_HELLO;
      descriptionText.text = import.meta.env.VITE_DESC_TEXT;
    }
  },
);

// 页面宽度、移动端菜单、盒子、设置页、壁纸模式或问候语变化时，重新适配字号与位置
watch(
  () => [
    store.innerWidth,
    store.mobileOpenState,
    store.boxOpenState,
    store.setOpenState,
    store.backgroundShow,
    greeting.value,
  ],
  () => nextTick(fitGreeting),
);

onMounted(() => {
  fitGreeting();
  // 字体加载完成后字宽和墨迹会变化，再适配一次
  document.fonts?.ready?.then(fitGreeting);
});
</script>

<style lang="scss" scoped>
.message {
  .logo {
    display: flex;
    flex-direction: row;
    align-items: center;
    animation: fade 0.5s;
    max-width: 460px;
    .logo-img {
      border-radius: 50%;
      width: 120px;
    }
    .name {
      width: 100%;
      min-width: 0;
      // 固定高度，换字体时 logo 区域和下方简介的位置不会被撑开
      height: 140px;
      padding-left: 22px;
      // 测试其他字体时改这里，或直接替换 /public/font/Pacifico-Regular.ttf
      font-family: "Pacifico-Regular";
      overflow: visible;
      white-space: nowrap;

      .bg {
        display: inline-block;
        font-size: 6rem;
        line-height: 1;
      }
    }
    @media (max-width: 768px) {
      .logo-img {
        width: 100px;
      }
      .name {
        height: 128px;
        .bg {
          font-size: 5.4rem;
        }
      }
    }

    @media (max-width: 720px) {
      max-width: 100%;
    }
  }

  .description {
    padding: 1rem;
    margin-top: 3.5rem;
    max-width: 460px;
    animation: fade 0.5s;

    .content {
      display: flex;
      justify-content: space-between;

      .text {
        margin: 0.75rem 1rem;
        line-height: 2rem;
        margin-right: auto;

        p {
          &:nth-of-type(1) {
            font-family: "Pacifico-Regular";
          }
        }
      }

      .xicon:nth-of-type(2) {
        align-self: flex-end;
      }
    }
    @media (max-width: 720px) {
      max-width: 100%;
      pointer-events: none;
    }
  }
  @media (max-width: 390px) {
    .logo {
      flex-direction: column;
      .logo-img {
        display: none;
      }
      .name {
        margin-left: 0;
        height: 98px;
        text-align: center;
        .bg {
          font-size: 4.2rem;
        }
      }
    }
    .description {
      margin-top: 2.5rem;
    }
  }
}
</style>
