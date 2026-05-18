#!/bin/bash
# Деплой staging-бэкенда на VPS.
# Использует docker-compose.staging.yml + .env.staging
#
# Запуск: bash scripts/deploy-staging.sh
# Требует: SSH-ключ ~/.ssh/zov_vps_ed25519, .env.staging на VPS

set -e

VPS="root@94.241.170.144"
SSH="ssh -i $HOME/.ssh/zov_vps_ed25519"
REMOTE_DIR="/opt/zov-tech"

echo "🚀 Деплой STAGING → $VPS"

# 1. Синхронизируем код
echo "  [1/3] git pull на VPS..."
$SSH $VPS "cd $REMOTE_DIR && git pull origin master"

# 2. Проверяем .env.staging
echo "  [2/3] Проверка .env.staging..."
$SSH $VPS "
  if [ ! -f $REMOTE_DIR/deploy/.env.staging ]; then
    echo 'ERROR: .env.staging не найден!'
    echo 'Скопируйте deploy/.env.staging.example → deploy/.env.staging и заполните.'
    exit 1
  fi
  if grep -q 'ЗАМЕНИТЕ' $REMOTE_DIR/deploy/.env.staging; then
    echo 'ERROR: .env.staging содержит незаполненные поля (ЗАМЕНИТЕ)!'
    exit 1
  fi
  echo 'OK'
"

# 3. Пересобираем и запускаем
echo "  [3/3] docker compose up --build..."
$SSH $VPS "
  cd $REMOTE_DIR/deploy
  docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
"

echo ""
echo "✅ Staging задеплоен!"
echo "   Backend: https://staging.api.wasrusgen1.pro/healthz"
echo "   MiniApp: https://wasrusgen.github.io/zov-tech/?backend=https://staging.api.wasrusgen1.pro"
echo ""
echo "🧪 Запуск smoke-тестов против staging:"
echo "   SMOKE_URL='https://wasrusgen.github.io/zov-tech/?backend=https://staging.api.wasrusgen1.pro' node tests/ui_smoke.js"
