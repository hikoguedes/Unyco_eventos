FROM node:20-alpine

WORKDIR /app

# Instala curl para healthchecks e dependências de build se necessário
RUN apk add --no-cache curl

# Copia arquivos de pacotes para instalar dependências
COPY package*.json ./

RUN npm install

# Copia o restante da aplicação
COPY . .

# Expõe a porta da aplicação
EXPOSE 3000

# Executa em modo de desenvolvimento com hot-reload nativo do Node 20
CMD ["npm", "run", "dev"]
