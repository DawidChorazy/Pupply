# MinIO no longer publishes the community images used by this project.
# Build the same server/client releases from pinned upstream commits instead.
FROM docker.io/library/golang:1.24.2-bookworm AS build

ENV CGO_ENABLED=0
WORKDIR /src/minio
RUN git init -q \
  && git remote add origin https://github.com/minio/minio.git \
  && git fetch --depth 1 origin 0d7408fc9969caf07de6a8c3a84f9fbb10a6739e \
  && git checkout --detach FETCH_HEAD \
  && go build -p 2 -trimpath -ldflags="-s -w" -o /out/minio .

WORKDIR /src/mc
RUN git init -q \
  && git remote add origin https://github.com/minio/mc.git \
  && git fetch --depth 1 origin b00526b153a31b36767991a4f5ce2cced435ee8e \
  && git checkout --detach FETCH_HEAD \
  && go build -p 2 -trimpath -ldflags="-s -w" -o /out/mc .

FROM docker.io/library/alpine:3.21
RUN apk add --no-cache ca-certificates curl
COPY --from=build /out/minio /out/mc /usr/local/bin/
COPY --from=build /src/minio/LICENSE /usr/share/licenses/minio/LICENSE
COPY --from=build /src/mc/LICENSE /usr/share/licenses/mc/LICENSE
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
