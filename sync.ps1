# 1. 定义路径（请根据你的实际路径修改）
$source = "C:\Users\yedou\Documents\Obsidian Vault\blog"
$destination = "D:\blog\my-blog\src"

# 2. 同步文件 (robocopy 是 Windows 强大的同步工具)
# /MIR: 镜像目录（源头删了，目的地也会删）
# /MT:32: 多线程加快速度
# /XD: 排除文件夹（可选）
robocopy $source $destination /MIR /MT:32 /XD ".vuepress" /XF "*.json" ".DS_Store"

# 3. 自动提交到 GitHub
cd "D:\blog\my-blog"
git add .
git commit -m "chore: 自动化更新笔记 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git push origin main