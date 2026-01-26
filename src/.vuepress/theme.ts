import { hopeTheme } from "vuepress-theme-hope";
import navbar from "./navbar.js";

export default hopeTheme({
  // 修改为你的 GitHub Pages 地址
  hostname: "https://yedou37.github.io",

  author: {
    name: "yedou",
    url: "https://yedou37.github.io",
  },

  // 这里的图标你可以换成自己的，或者先注释掉
  logo: "",

  // 填写你的代码库地址，方便点击“编辑此页”
  repo: "yedou37/yedou37.github.io",

  docsDir: "src",

  // 导航栏配置（从 navbar.js 导入）
  navbar,

  // 【最关键修改】：自动生成侧边栏。
  // 它会根据你 src 文件夹下的目录结构，自动生成左侧树状菜单
  sidebar: "structure",

  // 页脚配置
  footer: "记录面试复习 & 课程大作业",
  displayFooter: true,

  // 博客功能：如果你不需要“个人介绍、时间轴”等，直接关闭或设为 false
  blog: {
    description: "正在整理笔记的开发者",
    // 删除了下面一堆演示用的社交链接，你可以根据需要保留一两个
    medias: {
      GitHub: "https://github.com/yedou37",
    },
  },

  // 多语言配置
  metaLocales: {
    editLink: "在 GitHub 上编辑此页",
  },

  // Markdown 增强配置：这是为了完美兼容 Obsidian
  markdown: {
    align: true,
    attrs: true,
    codeTabs: true,
    component: true,
    figure: true,
    gfm: true,
    imgLazyload: true,
    imgSize: true,
    mark: true,
    sub: true,
    sup: true,
    tabs: true,
    tasklist: true,
    // 开启 Hint 插件，这是支持 Obsidian [!info] 等 Callouts 的核心
    hint: true,
  },

  plugins: {
    // 关闭原本开启的博客插件，让界面回归文档笔记风格
    blog: false,

    components: {
      components: ["Badge", "VPCard"],
    },

    // 图标插件配置
    icon: {
      prefix: "fa6-solid:",
    },
  },
});
