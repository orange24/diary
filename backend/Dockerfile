# ใช้ Go 1.26 ตามที่ go.mod ต้องการ
FROM golang:1.26-alpine AS builder

WORKDIR /app

# ก๊อปปี้ไฟล์จัดการ Library มาก่อน
COPY go.mod go.sum ./
RUN go mod download

# ก๊อปปี้โค้ดทั้งหมด
COPY . .

# สั่ง Build โดยระบุ Path ไปที่ main.go 
# จากรูป Log ของคุณ ไฟล์หลักน่าจะอยู่ที่ ./cmd/server หรือ ./cmd
# ลองใช้ ./cmd ก่อน ถ้าไม่ได้ให้เปลี่ยนเป็น .
RUN go build -o server ./cmd

# ใช้ Image ขนาดเล็กสำหรับรันจริง
FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/server .

# GCP จะส่ง Port มาให้ผ่าน Environment Variable
ENV PORT 8080
EXPOSE 8080

CMD ["./server"]