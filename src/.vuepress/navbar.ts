import { navbar } from "vuepress-theme-hope";

export default navbar([
  "/", // 首页
  {
    text: "interview",
    icon: "pen-to-square",
    link: "/interview/", // 对应 src/interview/ 目录
  },
  {
    text: "课程大作业",
    icon: "book",
    link: "/courses/", // 对应 src/courses/ 目录
  },
  {
    text: "GitHub",
    icon: "hashtag",
    link: "https://github.com/yedou37/yedou37.github.io",
  },
]);
