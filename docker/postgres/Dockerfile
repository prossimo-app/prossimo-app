ARG POSTGRES_IMAGE=ghcr.io/gui/postgis:18-postgis-3.6
FROM ${POSTGRES_IMAGE}

ENV POSTGRES_DB=prossimo
ENV POSTGRES_USER=prossimo
ENV POSTGRES_PASSWORD=prossimo

COPY init-postgis.sql /docker-entrypoint-initdb.d/10-init-postgis.sql

EXPOSE 5432
