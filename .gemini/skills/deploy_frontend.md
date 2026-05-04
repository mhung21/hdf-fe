# Skill: Deploy Frontend (HDF CrediFlow)

Skill này dùng để build và deploy frontend `hdf-fe` lên server `103.176.179.103`.

## Yêu cầu

- **Hỏi người dùng** chọn môi trường: `prod` hoặc `dev` (test)
- Nếu không chỉ rõ, **PHẢI hỏi lại** trước khi thực hiện

## Thông tin server

| Key | Value |
|---|---|
| SSH User | `hypm` |
| SSH Password | `12345678` |
| Server IP | `103.176.179.103` |

## Cấu hình theo môi trường

| | **Production (prod)** | **Dev/Test (dev)** |
|---|---|---|
| Angular config | `production` | `test` |
| Environment file | `environment.prod.ts` | `environment.test.ts` |
| apiUrl | `https://quanly.hdfinanceco.vn` | `http://103.176.179.103:8883` |
| authUrl | `https://quanly.hdfinanceco.vn` | `http://103.176.179.103:8884` |
| Deploy path | `/var/www/hdf-fe` | `/var/www/hdf-fe-test` |
| URL | `https://quanly.hdfinanceco.vn` | `http://103.176.179.103:8080` |

## Các bước thực hiện

### Bước 1: Build

```bash
cd d:\SourceCode\Hdf\hdf-fe

# Production
pnpm build --configuration production

# Hoặc Dev/Test
pnpm build --configuration test
```

**Output directory:** `dist/crediflow-fe/browser/`

### Bước 2: Deploy lên server (SCP)

```bash
# Production
scp -r dist/crediflow-fe/browser/* hypm@103.176.179.103:/var/www/hdf-fe/

# Dev/Test
scp -r dist/crediflow-fe/browser/* hypm@103.176.179.103:/var/www/hdf-fe-test/
```

> **Lưu ý:** Password SSH là `12345678`. Nếu `scp` yêu cầu nhập password, hãy nhập tự động.

### Bước 3: Xác nhận

Sau khi deploy xong, thông báo cho người dùng:
- **Prod:** `https://quanly.hdfinanceco.vn`
- **Dev:** `http://103.176.179.103:8080`

## Lưu ý quan trọng

1. **KHÔNG** deploy nhầm môi trường — luôn kiểm tra configuration trước khi build
2. **KHÔNG** dùng `pnpm build` mà không có `--configuration` — mặc định sẽ là `production`
3. Build `test` config sẽ tự replace `environment.ts` bằng `environment.test.ts`
4. Build `production` config sẽ tự replace `environment.ts` bằng `environment.prod.ts`
5. Package manager là **pnpm** (không dùng npm)
