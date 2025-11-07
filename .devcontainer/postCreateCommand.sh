set -euo pipefail

echo "🔧 postCreateCommand started..."

# install node + pnpm
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs
apt-get clean && rm -rf /var/lib/apt/lists/*
corepack enable
corepack prepare pnpm@latest --activate

# backend deps
cd api || exit 1
dotnet restore ./TimeCapsule/TimeCapsule.csproj

# frontend deps
cd ../web || exit 1
pnpm install --frozen-lockfile