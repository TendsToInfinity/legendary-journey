#
# Stage 1: Build
#
FROM mi-nexus02.dal.securustech.net:8080/base/nodejs:24 AS build

# Install system dependencies
RUN apt-get update && apt-get install -y default-jre-headless

# Prepare Yarn and dependencies
WORKDIR /code
# COPY .yarn/releases ./.yarn/releases
COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json ./
COPY packages/catalog/package.json ./packages/catalog/
RUN yarn install

# Add monorepo
COPY . .

# Build required workspaces
RUN yarn workspaces foreach --recursive --topological-dev --from catalog-task run build

# Remove unnecessary dependencies
RUN yarn workspaces focus catalog-task --production

#
# Stage 2: Production Image
#
FROM mi-nexus02.dal.securustech.net:8080/base/nodejs:24 AS prod

# Add /wait script
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.11.0/wait /wait
RUN chmod +x /wait

# Add node user and setup application directory
RUN useradd --uid 1000 --user-group --shell /bin/nologin --create-home node
WORKDIR /code
RUN chown node:node .
USER node

# Copy required yarn/monorepo files
COPY --chown=node:node --from=build /code/package.json /code/package.json
COPY --chown=node:node --from=build /code/node_modules /code/node_modules
COPY --chown=node:node --from=build /code/yarn.lock /code/yarn.lock
COPY --chown=node:node --from=build /code/.yarnrc.yml /code/.yarnrc.yml
COPY --chown=node:node --from=build /code/.yarn /code/.yarn

# Copy just the requisite files from the service in order to avoid publishing sensitive info in the container.
# In particular, "private.pem" should not be included.
COPY --chown=node:node --from=build /code/packages/catalog/db /code/packages/catalog/db
COPY --chown=node:node --from=build /code/packages/catalog/dist /code/packages/catalog/dist
COPY --chown=node:node --from=build /code/packages/catalog/package.json /code/packages/catalog
COPY --chown=node:node --from=build /code/packages/catalog/config /code/packages/catalog/config
COPY --chown=node:node --from=build /code/packages/catalog/public.pem /code/packages/catalog
COPY --chown=node:node --from=build /code/packages/catalog/private.pem /code/packages/catalog

# Set workdir and command.
WORKDIR /code/packages/catalog
CMD ["yarn", "node", "dist/src/main.js"]

#
# Stage 3: Integration Test Image
#
FROM prod as test

# Add all monorepo files and dependencies
COPY --chown=node:node --from=build /code /code
RUN yarn install

# Set workdir and launch command for development environment
WORKDIR /code
CMD ["bash", "-c", "/wait && yarn workspace catalog-task prestart && yarn workspace catalog-task db:init && yarn workspace catalog-task start"]

#
# Stage 4: Set Production Image as the default target
#
FROM prod
