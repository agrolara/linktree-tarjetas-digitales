# Dockerfile para despliegue en Coolify / VPS / Render
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el código fuente
COPY . .

# Exponer el puerto
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Iniciar servidor
CMD ["node", "server.js"]
