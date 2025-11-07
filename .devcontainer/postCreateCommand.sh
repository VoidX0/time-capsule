echo "🔧 postCreateCommand started..."

# install node + pnpm
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs
corepack enable pnpm

# backend deps
cd api || exit 1
dotnet restore TimeCapsule/TimeCapsule.csproj

# frontend deps
cd web || exit 1
pnpm install --frozen-lockfile
