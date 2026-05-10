FROM python:3.12-slim

# НУЦ Минцифры root CA — для GigaChat SSL.
# Скачиваем актуальный bundle на этапе сборки и добавляем в системный trust store.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -fsSL -o /usr/local/share/ca-certificates/russian_trusted_root_ca.crt \
        https://gu-st.ru/content/Other/doc/russian_trusted_root_ca.cer \
 && curl -fsSL -o /usr/local/share/ca-certificates/russian_trusted_sub_ca.crt \
        https://gu-st.ru/content/Other/doc/russian_trusted_sub_ca.cer \
 && update-ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app /app/app

# httpx по умолчанию использует certifi → принудительно указываем системный bundle,
# куда мы добавили НУЦ Минцифры
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
