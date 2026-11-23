# سرور مرکزی مشاغل — تصویر اجرایی (بدون وابستگی npm)
FROM node:22-slim AS runtime

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    MASHQEL_DB=/data/mashaqel.sqlite

WORKDIR /app

COPY server ./server
COPY web ./web

RUN mkdir -p /data && chown -R node:node /data /app

USER node

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.mjs"]
