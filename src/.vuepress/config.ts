import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

export default defineUserConfig({
  // 如果你的仓库名是 yedou37.github.io，这里填 "/"
  // 如果是其他名字（如 blog），这里填 "/blog/"
  base: "/",

  lang: "zh-CN",
  title: "Yedou's Notebook", // 修改为你想要的标题
  description: "记录面试复习与各个课程大作业的个人笔记",

  theme,

  // 预读取资源，一般保持默认即可
  shouldPrefetch: false,
});
