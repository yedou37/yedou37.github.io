# 强制设置 PowerShell 终端输出为 UTF-8，解决中文乱码
$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = New-Object System.Text.Encoding.UTF8Encoding($false)

# 1. 定义路径
$source = "C:\Users\yedou\Documents\Obsidian Vault\blog"
$destination = "D:\blog\my-blog\src"

# 2. 同步文件
# /MIR: 镜像目录
# /XD: 排除 .vuepress 配置文件目录，非常重要！
robocopy $source $destination /MIR /MT:32 /XD ".vuepress" /XF "*.json" ".DS_Store"

# 3. 自动提交到 GitHub
cd "D:\blog\my-blog"

# 先尝试拉取远程更新（防止冲突）
# git pull origin main

git add .
$commitMsg = "chore: 自动化更新笔记 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m $commitMsg
git push origin main