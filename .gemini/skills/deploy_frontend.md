# Skill: Deploy Frontend (hdf-fe)

## Tổng quan

Frontend là ứng dụng Angular, deploy bằng cách **build static files** rồi **SCP lên server**.  
Không dùng Docker cho frontend.

---

## Môi trường

| Môi trường | Angular Config | Environment File | Deploy Path | URL |
|---|---|---|---|---|
| **Dev/Test** | `test` | `environment.test.ts` | `/var/www/hdf-fe-test` | `http://103.176.179.103:8080` |
| **Production** | `production` | `environment.prod.ts` | `/var/www/hdf-fe` | `https://quanly.hdfinanceco.vn` |

### API Endpoints theo môi trường

| Môi trường | apiUrl | authUrl |
|---|---|---|
| Dev/Test | `http://103.176.179.103:8883` | `http://103.176.179.103:8884` |
| Production | `https://quanly.hdfinanceco.vn` | `https://quanly.hdfinanceco.vn` |

---

## Quy trình Deploy

### Bước 0: Chọn môi trường

> **BẮT BUỘC:** Trước khi deploy, hỏi người dùng chọn môi trường. Nếu người dùng không chỉ định rõ, **phải hỏi lại**.

| Lựa chọn | `CONFIG` | `DEPLOY_PATH` | URL sau deploy |
|---|---|---|---|
| **dev** | `test` | `/var/www/hdf-fe-test` | `http://103.176.179.103:8080` |
| **prod** | `production` | `/var/www/hdf-fe` | `https://quanly.hdfinanceco.vn` |

Các bước bên dưới sử dụng `{CONFIG}` và `{DEPLOY_PATH}` tương ứng với lựa chọn ở trên.

---

### Bước 1: Build

```powershell
cd d:\SourceCode\Hdf\hdf-fe
npm run build -- --configuration {CONFIG}
```

> **Lưu ý:** `pnpm` không khả dụng trên máy hiện tại, dùng `npm run build` thay thế.

**Output directory:** `dist/crediflow-fe/browser/`

### Bước 2: SCP lên server

SCP trên Windows yêu cầu password nhưng không hỗ trợ pipe password trực tiếp.  
Dùng `SSH_ASKPASS` để tự động truyền password.

#### Chuẩn bị askpass script (chỉ cần tạo 1 lần)

File `askpass.cmd` đã có sẵn trong `d:\SourceCode\Hdf\hdf-fe\`:

```batch
@echo off
echo 12345678
```

#### Chạy SCP với SSH_ASKPASS

```powershell
$env:SSH_ASKPASS = "d:\SourceCode\Hdf\hdf-fe\askpass.cmd"
$env:SSH_ASKPASS_REQUIRE = "force"
$env:DISPLAY = "dummy"

scp -o StrictHostKeyChecking=no -r dist/crediflow-fe/browser/* hypm@103.176.179.103:{DEPLOY_PATH}/
```

> **Lưu ý:** Lần SCP đầu tiên có thể mất 5-10 phút do có nhiều file icons (~2000+ SVG từ Taiga UI).

### Bước 3: Xử lý lỗi Permission Denied (nếu có)

Nếu SCP báo `Permission denied` khi ghi file, cần fix quyền trên server trước rồi chạy lại Bước 2:

```powershell
$env:SSH_ASKPASS = "d:\SourceCode\Hdf\hdf-fe\askpass.cmd"
$env:SSH_ASKPASS_REQUIRE = "force"
$env:DISPLAY = "dummy"

ssh -o StrictHostKeyChecking=no hypm@103.176.179.103 "echo 12345678 | sudo -S chown -R hypm:hypm {DEPLOY_PATH}/"
```

---

## One-liner Deploy (copy & paste)

### Deploy Dev/Test

```powershell
cd d:\SourceCode\Hdf\hdf-fe; npm run build -- --configuration test; $env:SSH_ASKPASS="d:\SourceCode\Hdf\hdf-fe\askpass.cmd"; $env:SSH_ASKPASS_REQUIRE="force"; $env:DISPLAY="dummy"; scp -o StrictHostKeyChecking=no -r dist/crediflow-fe/browser/* hypm@103.176.179.103:/var/www/hdf-fe-test/
```

### Deploy Production

```powershell
cd d:\SourceCode\Hdf\hdf-fe; npm run build -- --configuration production; $env:SSH_ASKPASS="d:\SourceCode\Hdf\hdf-fe\askpass.cmd"; $env:SSH_ASKPASS_REQUIRE="force"; $env:DISPLAY="dummy"; scp -o StrictHostKeyChecking=no -r dist/crediflow-fe/browser/* hypm@103.176.179.103:/var/www/hdf-fe/
```

---

## Thông tin Server

| Thông tin | Giá trị |
|---|---|
| **IP** | `103.176.179.103` |
| **SSH User** | `hypm` |
| **SSH Password** | `12345678` |

---

## Checklist trước khi deploy

- [ ] Đúng configuration (`test` cho dev, `production` cho prod)
- [ ] Build thành công, không có error (warning budget có thể bỏ qua)
- [ ] Kiểm tra `environment.test.ts` hoặc `environment.prod.ts` có đúng API URL
- [ ] Sau deploy, mở trình duyệt kiểm tra trang load đúng
