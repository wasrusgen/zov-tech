FROM python:3.12-slim

# НУЦ Минцифры root CA — для GigaChat SSL.
# + системные пакеты для Playwright/Chromium (рендеринг JS-сайтов).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        ca-certificates curl \
        # Chromium dependencies for Playwright
        libnss3 libnspr4 libatk-bridge2.0-0 libatk1.0-0 libcups2 \
        libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
        libgbm1 libgtk-3-0 libasound2 libpango-1.0-0 libcairo2 \
        libdbus-1-3 libdrm2 libxshmfence1 \
        fonts-liberation fonts-noto-color-emoji \
 && curl -fsSL -o /usr/local/share/ca-certificates/russian_trusted_root_ca.crt \
        https://gu-st.ru/content/Other/doc/russian_trusted_root_ca.cer \
 && curl -fsSL -o /usr/local/share/ca-certificates/russian_trusted_sub_ca.crt \
        https://gu-st.ru/content/Other/doc/russian_trusted_sub_ca.cer \
 && update-ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Скачиваем только Chromium (без firefox/webkit) — ~150MB
RUN python -m playwright install chromium

COPY app /app/app

# httpx по умолчанию использует certifi → принудительно указываем системный bundle,
# куда мы добавили НУЦ Минцифры
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

# Playwright кэш-каталог браузеров
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
