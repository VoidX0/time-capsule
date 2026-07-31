#!/bin/bash

CODE_SERVER="/tmp/vscode-web/bin/code-server"
SETTINGS="$HOME/.vscode-server/data/Machine/settings.json"
echo "⚙️ Coder up script executed."

echo "⚙️ Install packages..."

echo "🧩 Waiting VSCode..."
while ! curl -s http://127.0.0.1:13338/ > /dev/null; do
  echo "⏳ VSCode Web is starting, waiting 3s..."
  sleep 3
done
# 额外再等 10 秒
echo "⏳ Waiting 10s for VSCode Web background tasks to settle..."
sleep 10
echo "🚀 VSCode Web is ready! Installing extensions..."

echo "🧩 Installing extension..."
# common
$CODE_SERVER --install-extension tamasfe.even-better-toml
# backend
$CODE_SERVER --install-extension ms-dotnettools.csharp
$CODE_SERVER --install-extension ms-dotnettools.csdevkit
# frontend
$CODE_SERVER --install-extension dbaeumer.vscode-eslint
$CODE_SERVER --install-extension esbenp.prettier-vscode
$CODE_SERVER --install-extension pulkitgangwar.nextjs-snippets
$CODE_SERVER --install-extension bradlc.vscode-tailwindcss

echo "🔧 Configuring editor settings..."
