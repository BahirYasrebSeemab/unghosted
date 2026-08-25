FROM golang:1.26-alpine AS build
WORKDIR /src

# go.mod pins go 1.26.4 exactly; GOTOOLCHAIN=auto (the Go default) lets the
# build fetch that precise patch release if the base image's isn't a match.
ENV GOTOOLCHAIN=auto

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/seedadmin ./cmd/seedadmin

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app

COPY --from=build /out/server ./server
COPY --from=build /out/seedadmin ./seedadmin

# Railway injects PORT; the app reads it (falls back to 3000 if unset).
CMD ["./server"]
