#!/bin/bash

CODE_SERVER="/tmp/vscode-web/bin/code-server"
SETTINGS="$HOME/.vscode-server/data/Machine/settings.json"
echo "⚙️ Coder up script executed."

echo "⚙️ Install packages..."

echo "🧩Installing extension..."
# common
$CODE_SERVER --install-extension tamasfe.even-better-toml
# backend
$CODE_SERVER --install-extension ms-dotnettools.csdevkit
# frontend
$CODE_SERVER --install-extension dbaeumer.vscode-eslint
$CODE_SERVER --install-extension esbenp.prettier-vscode
$CODE_SERVER --install-extension pulkitgangwar.nextjs-snippets
$CODE_SERVER --install-extension bradlc.vscode-tailwindcss

echo "🔧Configuring editor settings..."