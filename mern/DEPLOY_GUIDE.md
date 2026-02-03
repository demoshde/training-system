# 🛡️ Аюулгүй Deployment Guide

## ✅ Танай өгөгдлийн сан АЮУЛГҮЙ байна

Танай систем Docker volume (`mongodb_data`) ашигладаг учир:
- Git рүү код шинэчлэх → **өгөгдөл хамаагүй**
- Container шинэчлэх → **өгөгдөл хадгалагдана**
- Container устгах → **өгөгдөл хадгалагдана**

---

## 📋 Аюулгүй шинэчлэлтийн алхамууд

### 1️⃣ Өгөгдлийн сангийн backup авах (Хамгийн чухал!)

```bash
cd /opt/training-system/training-system/mern

# Manual backup авах
docker exec training-mongo mongodump --db training_system --out /data/backups/manual_$(date +%Y%m%d_%H%M%S)

# Эсвэл Node.js backup script ашиглах
docker exec training-server node backup.js
```

### 2️⃣ Git-ээс код татах

```bash
cd /opt/training-system/training-system
git pull origin main
```

### 3️⃣ Application шинэчлэх (өгөгдөл УСТАХГҮЙ)

```bash
cd mern

# Зөвхөн code шинэчлэх - DB-г БИТГИЙ устга
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

---

## ⚠️ БИТГИЙ хийх зүйлс

```bash
# ❌ БИТГИЙ volume устга - энэ нь БҮХ өгөгдлийг устгана!
docker compose -f docker-compose.prod.yml down -v

# ❌ БИТГИЙ seed.js явуул production дээр
docker exec training-server node seed.js

# ❌ БИТГИЙ database container устга volume-тэй нь
docker volume rm mern_mongodb_data
```

---

## 🔄 Янз бүрийн шинэчлэлтийн төрлүүд

### Frontend шинэчлэх (React)
```bash
cd /opt/training-system/training-system/mern
docker compose -f docker-compose.prod.yml build client
docker compose -f docker-compose.prod.yml up -d client
```

### Backend шинэчлэх (Node.js)
```bash
docker compose -f docker-compose.prod.yml build server
docker compose -f docker-compose.prod.yml up -d server
```

### Бүгдийг шинэчлэх
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

---

## 💾 Backup & Restore

### Backup авах
```bash
# Автомат backup (timestamp-тай)
docker exec training-server node backup.js

# Гараар backup
docker exec training-mongo mongodump --db training_system --out /data/db/backup_$(date +%Y%m%d)
```

### Restore хийх
```bash
# Хамгийн сүүлийн backup restore хийх
docker exec training-server node restore.js

# Тодорхой backup restore хийх
docker exec training-mongo mongorestore --db training_system /data/db/backup_YYYYMMDD/training_system
```

---

## 🔍 Өгөгдөл хадгалагдсан эсэхийг шалгах

```bash
# Volume-үүдийг харах
docker volume ls

# MongoDB өгөгдлийн хэмжээг шалгах
docker exec training-mongo mongo training_system --eval "db.stats()"

# Бүх collection-ийг харах
docker exec training-mongo mongo training_system --eval "db.getCollectionNames()"

# Ажилчдын тоог харах (жишээ)
docker exec training-mongo mongo training_system --eval "db.workers.countDocuments()"
```

---

## 🚀 Deployment Script (Аюулгүй хувилбар)

Deploy script нь **зөвхөн код шинэчилнэ**, өгөгдлийг ХӨНДӨХГҮЙ:

```bash
sudo bash deploy.sh
```

---

## 📊 Volume байршил

Танай өгөгдөл энд байна:
```
/var/lib/docker/volumes/mern_mongodb_data/_data
```

Энэ folder нь `docker compose down` хийснээр УСТАХГҮЙ!

---

## ⚡ Quick Commands

```bash
# Logs харах
docker compose -f docker-compose.prod.yml logs -f

# Services дахин эхлүүлэх
docker compose -f docker-compose.prod.yml restart

# Services зогсоох (өгөгдөл УСТАХГҮЙ)
docker compose -f docker-compose.prod.yml down

# Container-үүдийн статус шалгах
docker compose -f docker-compose.prod.yml ps

# MongoDB shell нээх
docker exec -it training-mongo mongo training_system
```

---

## 🎯 Тайлбар

1. **Docker Volume** = Хатуу диск дээрх хадгалах сан
2. **Container** = Программ ажиллуулдаг орчин (устааж болно)
3. **Image** = Программын загвар (дахин build хийж болно)
4. **Volume** ≠ **Container** (container устсан ч volume үлдэнэ)

Таны өгөгдөл `mongodb_data` volume дотор, containers-аас **БИЕ ДААСАН** байна!

---

## 📞 Алдаа гарвал

Хэрэв алдаа гарвал:
1. Эхлээд backup шалга: `ls -la backups/`
2. Logs шалга: `docker compose -f docker-compose.prod.yml logs`
3. Database холбогдож байгаа эсэхийг шалга
