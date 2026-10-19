FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /picker ./cmd/picker

# The "nonroot" variant runs as an unprivileged user (uid 65532), not root.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /picker /picker
EXPOSE 8081
ENTRYPOINT ["/picker"]
