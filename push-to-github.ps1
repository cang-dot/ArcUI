param(
    [string]$GitHubUser = "cang-dot"
)

$repoName = "ArcUI"
$repoUrl = "https://github.com/${GitHubUser}/${repoName}.git"
$targetDir = "C:\Users\Administrator\Desktop\${repoName}"

Write-Host "=== 初始化 Git 仓库并推送 ArcUI ===" -ForegroundColor Cyan

Set-Location -LiteralPath $targetDir

if (-not (Test-Path ".git")) {
    git init
    Write-Host "Git 仓库已初始化" -ForegroundColor Green
} else {
    Write-Host "Git 仓库已存在" -ForegroundColor Yellow
}

if (-not (Test-Path ".gitignore")) {
@"
backend/__pycache__/
*.pyc
.DS_Store
Thumbs.db
node_modules/
"@ | Set-Content -Path ".gitignore" -Encoding UTF8
    Write-Host ".gitignore 已创建" -ForegroundColor Green
}

git add .
git commit -m "Initial commit: ArcUI - Universal AI Chat Frontend"

$remotes = git remote
if (-not $remotes) {
    git remote add origin $repoUrl
    Write-Host "Remote origin 已添加: $repoUrl" -ForegroundColor Green
} else {
    Write-Host "Remote origin 已存在: $(git remote get-url origin)" -ForegroundColor Yellow
}

git branch -M main

# 检查远程是否有已有内容
Write-Host "正在检查远程仓库状态 ..." -ForegroundColor Cyan
$remoteExists = git ls-remote --heads origin main 2>$null
if ($remoteExists) {
    Write-Host "远程仓库已有内容，执行 pull 合并 ..." -ForegroundColor Yellow
    git pull origin main --allow-unrelated-histories --no-edit
}

Write-Host "正在推送到 GitHub ..." -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "=== 推送完成 ===" -ForegroundColor Green
Write-Host "仓库地址: $repoUrl"
