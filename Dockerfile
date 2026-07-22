FROM node:20-alpine

WORKDIR /app

# Dependencias de producción primero (cacheado por Docker)
COPY package*.json ./
RUN npm ci --production --silent

# Copiar el código de la app
COPY . .

# El volumen externo sobreescribirá este directorio; el archivo de pruebas nunca llega a la imagen
RUN rm -f data/data.json

# Crear directorio de datos por si no hay volumen externo
RUN mkdir -p /app/data

# Puerto expuesto
EXPOSE 3000

# Arranque
CMD ["node", "server.js"]
