@echo off
echo ================================================
echo Deploying AttendBox Frontend to Cloudflare Pages
echo ================================================
echo.

cd /d "%~dp0"

echo Building frontend...
call npm run build

echo.
echo Deploying to Cloudflare Pages...
call npx wrangler pages deploy dist --project-name=attendbox

echo.
echo ================================================
echo Deployment Complete!
echo Your site will be live at: https://attendbox.pages.dev
echo ================================================
pause
