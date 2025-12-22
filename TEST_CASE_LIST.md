# Test Case List - TechRent-Mobile

## Function List

| No | Function Name | Sheet Name | Description | Pre-Condition |
|----|---------------|------------|-------------|---------------|
| 1 | Date Utilities | dates.test.ts | Các hàm xử lý ngày tháng: normalize, add/subtract, format | Jest configured, dates.ts exists |
| 2 | Cart Store | cart-store.test.ts | Zustand store quản lý giỏ hàng: add, update, remove, clear | Jest configured, cart-store.ts exists |
| 3 | API Utilities | api.test.ts | Các hàm API: URL building, retry logic | Jest configured, api.ts exists |
| 4 | API Contract | api-contract.test.ts | Test response handling: 200, 400, 401, 500, empty | MSW configured, handlers.ts exists |
| 5 | Component Logic | example-component.test.tsx | Component helper functions logic | Jest configured |

---

## 1. Date Utilities (dates.test.ts)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| DATE-001 | clampToStartOfDay - set time | Đặt thời gian về 00:00:00.000 | 1. Tạo date với giờ 14:30:45<br>2. Gọi clampToStartOfDay() | Hours=0, Minutes=0, Seconds=0, Milliseconds=0 | None | PASS | 2024-12-13 | |
| DATE-002 | clampToStartOfDay - preserve date | Giữ nguyên phần ngày | 1. Tạo date 2024-06-20<br>2. Gọi clampToStartOfDay() | Year=2024, Month=5, Date=20 | None | PASS | 2024-12-13 | |
| DATE-003 | clampToStartOfDay - no mutation | Không thay đổi date gốc | 1. Lưu original date<br>2. Gọi clampToStartOfDay()<br>3. So sánh với original | Original không đổi | None | PASS | 2024-12-13 | |
| DATE-004 | addDays - positive | Thêm ngày dương | 1. Tạo date 15/01<br>2. Gọi addDays(5) | Date = 20/01 | None | PASS | 2024-12-13 | |
| DATE-005 | addDays - negative | Trừ ngày với giá trị âm | 1. Tạo date 15/01<br>2. Gọi addDays(-10) | Date = 05/01 | None | PASS | 2024-12-13 | |
| DATE-006 | addDays - month overflow | Xử lý tràn tháng | 1. Tạo date 30/01<br>2. Gọi addDays(5) | Month=1 (Feb), Date=4 | None | PASS | 2024-12-13 | |
| DATE-007 | addDays - year overflow | Xử lý tràn năm | 1. Tạo date 30/12/2024<br>2. Gọi addDays(5) | Year=2025, Month=0 | None | PASS | 2024-12-13 | |
| DATE-008 | startOfMonth | Trả về ngày đầu tháng | 1. Tạo date 15/06<br>2. Gọi startOfMonth() | Date=1, Month=5 | None | PASS | 2024-12-13 | |
| DATE-009 | addMonths - normal | Thêm tháng bình thường | 1. Tạo date 15/01<br>2. Gọi addMonths(3) | Month=3 (April), Date=1 | None | PASS | 2024-12-13 | |
| DATE-010 | addMonths - year overflow | Thêm tháng qua năm mới | 1. Tạo date 15/11<br>2. Gọi addMonths(3) | Year=2025, Month=1 | None | PASS | 2024-12-13 | |
| DATE-011 | endOfMonth - 31 days | Ngày cuối tháng 31 ngày | 1. Tạo date tháng 1<br>2. Gọi endOfMonth() | Date=31 | None | PASS | 2024-12-13 | |
| DATE-012 | endOfMonth - leap year | Ngày cuối tháng 2 năm nhuận | 1. Tạo date 02/2024<br>2. Gọi endOfMonth() | Date=29 | None | PASS | 2024-12-13 | |
| DATE-013 | endOfMonth - non-leap year | Ngày cuối tháng 2 năm thường | 1. Tạo date 02/2023<br>2. Gọi endOfMonth() | Date=28 | None | PASS | 2024-12-13 | |
| DATE-014 | isSameDay - true | So sánh 2 ngày giống nhau | 1. Tạo 2 date giống nhau<br>2. Gọi isSameDay() | true | None | PASS | 2024-12-13 | |
| DATE-015 | isSameDay - false | So sánh 2 ngày khác nhau | 1. Tạo 2 date khác nhau<br>2. Gọi isSameDay() | false | None | PASS | 2024-12-13 | |
| DATE-016 | formatDisplayDate | Format ngày hiển thị | 1. Tạo date 15/01/2024<br>2. Gọi formatDisplayDate() | Chứa "2024" và "15" | None | PASS | 2024-12-13 | |
| DATE-017 | generateCalendarDays - length | Trả về 42 ngày (6 tuần) | 1. Tạo date đầu tháng<br>2. Gọi generateCalendarDays() | Length = 42 | None | PASS | 2024-12-13 | |
| DATE-018 | generateCalendarDays - first day | Bao gồm ngày đầu tháng | 1. Tạo date 01/06<br>2. Gọi generateCalendarDays() | Có ngày 01/06 trong kết quả | None | PASS | 2024-12-13 | |
| DATE-019 | parseDateParam - valid | Parse date string hợp lệ | 1. Gọi parseDateParam("2024-06-15") | Year=2024, Month=5, Date=15 | None | PASS | 2024-12-13 | |
| DATE-020 | parseDateParam - invalid | Trả về fallback khi invalid | 1. Gọi parseDateParam("invalid") | Trả về fallback date | None | PASS | 2024-12-13 | |
| DATE-021 | parseDateParam - non-string | Trả về fallback khi không phải string | 1. Gọi parseDateParam(12345) | Trả về fallback date | None | PASS | 2024-12-13 | |
| DATE-022 | parseDateParam - null/undefined | Trả về fallback khi null/undefined | 1. Gọi parseDateParam(null) | Trả về fallback date | None | PASS | 2024-12-13 | |
| DATE-023 | WEEKDAY_LABELS - length | Có 7 ngày trong tuần | 1. Kiểm tra WEEKDAY_LABELS.length | Length = 7 | None | PASS | 2024-12-13 | |
| DATE-024 | WEEKDAY_LABELS - start | Bắt đầu bằng Sunday | 1. Kiểm tra WEEKDAY_LABELS[0] | "Sun" | None | PASS | 2024-12-13 | |
| DATE-025 | WEEKDAY_LABELS - end | Kết thúc bằng Saturday | 1. Kiểm tra WEEKDAY_LABELS[6] | "Sat" | None | PASS | 2024-12-13 | |

---

## 2. Cart Store (cart-store.test.ts)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| CART-001 | addItem - new item | Thêm item mới vào giỏ trống | 1. Clear cart<br>2. Gọi addItem(product, 2) | items.length=1, quantity=2 | None | PASS | 2024-12-13 | |
| CART-002 | addItem - existing | Tăng quantity cho item có sẵn | 1. addItem(product, 2)<br>2. addItem(product, 3) | items.length=1, quantity=5 | CART-001 | PASS | 2024-12-13 | |
| CART-003 | addItem - clamp stock | Giới hạn quantity theo stock | 1. Tạo product stock=5<br>2. addItem(product, 10) | quantity=5 | None | PASS | 2024-12-13 | |
| CART-004 | addItem - zero stock | Không thêm khi stock=0 | 1. Tạo product stock=0<br>2. addItem(product, 1) | items.length=0 | None | PASS | 2024-12-13 | |
| CART-005 | addItem - replace | Thay thế quantity khi replace=true | 1. addItem(product, 5)<br>2. addItem(product, 2, {replace: true}) | quantity=2 | CART-001 | PASS | 2024-12-13 | |
| CART-006 | addItem - normalize | Normalize quantity âm thành 1 | 1. addItem(product, -5) | quantity=1 | None | PASS | 2024-12-13 | |
| CART-007 | addItem - infinite stock | Xử lý stock undefined như vô hạn | 1. Tạo product stock=undefined<br>2. addItem(product, 100) | quantity=100 | None | PASS | 2024-12-13 | |
| CART-008 | updateQuantity - normal | Cập nhật quantity | 1. addItem(product, 2)<br>2. updateQuantity(id, 5) | quantity=5 | CART-001 | PASS | 2024-12-13 | |
| CART-009 | updateQuantity - zero | Xóa item khi quantity=0 | 1. addItem(product, 2)<br>2. updateQuantity(id, 0) | items.length=0 | CART-001 | PASS | 2024-12-13 | |
| CART-010 | updateQuantity - negative | Xóa item khi quantity âm | 1. addItem(product, 2)<br>2. updateQuantity(id, -1) | items.length=0 | CART-001 | PASS | 2024-12-13 | |
| CART-011 | updateQuantity - clamp | Giới hạn theo stock | 1. addItem(product stock=5, 2)<br>2. updateQuantity(id, 100) | quantity=5 | CART-001 | PASS | 2024-12-13 | |
| CART-012 | updateQuantity - not found | Không thay đổi khi không tìm thấy | 1. addItem(product, 2)<br>2. updateQuantity("non-existent", 5) | items.length=1, quantity=2 | CART-001 | PASS | 2024-12-13 | |
| CART-013 | updateQuantity - same | Không update nếu quantity giống | 1. addItem(product, 5)<br>2. updateQuantity(id, 5) | State không thay đổi | CART-001 | PASS | 2024-12-13 | |
| CART-014 | removeItem - success | Xóa item khỏi giỏ | 1. Add 2 products<br>2. removeItem(product1.id) | items.length=1, chỉ còn product2 | CART-001 | PASS | 2024-12-13 | |
| CART-015 | removeItem - not found | Xử lý xóa item không tồn tại | 1. addItem(product, 1)<br>2. removeItem("non-existent") | items.length=1 | CART-001 | PASS | 2024-12-13 | |
| CART-016 | clear - with items | Xóa tất cả items | 1. Add 2 products<br>2. clear() | items.length=0 | CART-001 | PASS | 2024-12-13 | |
| CART-017 | clear - empty cart | Clear giỏ trống | 1. clear() trên giỏ trống | items.length=0 | None | PASS | 2024-12-13 | |
| CART-018 | multiple products | Xử lý nhiều products | 1. Add 3 products với quantities 1,2,3 | items.length=3, quantities đúng | None | PASS | 2024-12-13 | |
| CART-019 | decimal quantity | Làm tròn quantity thập phân | 1. addItem(product, 2.7) | quantity=2 (floor) | None | PASS | 2024-12-13 | |

---

## 3. API Utilities (api.test.ts)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| API-001 | ensureApiUrl - configured | Trả về URL khi đã config | 1. Set EXPO_PUBLIC_API_URL<br>2. Gọi ensureApiUrl() | Trả về URL đã config | None | PASS | 2024-12-13 | |
| API-002 | ensureApiUrl - trailing slash | Xóa trailing slash | 1. Set URL có trailing slash<br>2. Gọi ensureApiUrl() | URL không có trailing slash | None | PASS | 2024-12-13 | |
| API-003 | ensureApiUrl - not configured | Throw error khi chưa config | 1. Xóa EXPO_PUBLIC_API_URL<br>2. Gọi ensureApiUrl() | Throw error | None | PASS | 2024-12-13 | |
| API-004 | buildApiUrl - single segment | Build URL với 1 segment | 1. Gọi buildApiUrl("users") | baseUrl + "/users" | API-001 | PASS | 2024-12-13 | |
| API-005 | buildApiUrl - multiple segments | Build URL với nhiều segments | 1. Gọi buildApiUrl("api", "v1", "users", 123) | baseUrl + "/api/v1/users/123" | API-001 | PASS | 2024-12-13 | |
| API-006 | buildApiUrl - slashes | Xử lý segments có slashes | 1. Gọi buildApiUrl("/api/", "/users/") | baseUrl + "/api/users" | API-001 | PASS | 2024-12-13 | |
| API-007 | buildApiUrl - empty segments | Bỏ qua segments rỗng | 1. Gọi buildApiUrl("api", "", "users") | baseUrl + "/api/users" | API-001 | PASS | 2024-12-13 | |
| API-008 | buildApiUrl - no segments | Trả về base URL | 1. Gọi buildApiUrl() | baseUrl only | API-001 | PASS | 2024-12-13 | |
| API-009 | buildApiUrl - numeric | Xử lý numeric segments | 1. Gọi buildApiUrl("orders", 12345) | baseUrl + "/orders/12345" | API-001 | PASS | 2024-12-13 | |
| API-010 | fetchWithRetry - success | Trả về response khi thành công | 1. Mock fetch thành công<br>2. Gọi fetchWithRetry() | Trả về response, fetch gọi 1 lần | None | PASS | 2024-12-13 | |
| API-011 | fetchWithRetry - http to https | Retry với HTTPS khi HTTP fail | 1. Mock fetch fail HTTP, pass HTTPS<br>2. Gọi fetchWithRetry(http://...) | Trả về response, fetch gọi 2 lần với https | None | PASS | 2024-12-13 | |
| API-012 | fetchWithRetry - onRetry | Gọi callback khi retry | 1. Mock fetch fail lần 1<br>2. Gọi fetchWithRetry với onRetry | onRetry được gọi với url mới | API-011 | PASS | 2024-12-13 | |
| API-013 | fetchWithRetry - max attempts | Throw sau max attempts | 1. Mock fetch luôn fail<br>2. Gọi fetchWithRetry maxAttempts=2 | Throw error | None | PASS | 2024-12-13 | |
| API-014 | fetchWithRetry - https no retry | Không retry nếu đã là HTTPS | 1. Mock fetch fail<br>2. Gọi fetchWithRetry(https://...) | Throw error, fetch gọi 1 lần | None | PASS | 2024-12-13 | |

---

## 4. API Contract Tests (api-contract.test.ts)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| CONTRACT-001 | Success - login | Xử lý login thành công | 1. POST /api/auth/login<br>2. Kiểm tra response | status=200, có accessToken, refreshToken | None | PASS | 2024-12-13 | MSW |
| CONTRACT-002 | Success - device models | Xử lý get device models | 1. GET /api/device-models<br>2. Kiểm tra response | status=200, có content array | None | PASS | 2024-12-13 | MSW |
| CONTRACT-003 | Error 400 - login | Xử lý login validation error | 1. Sử dụng badRequestHandlers<br>2. POST /api/auth/login | status=400, có message | None | PASS | 2024-12-13 | MSW |
| CONTRACT-004 | Error 400 - order validation | Xử lý order validation error | 1. Sử dụng badRequestHandlers<br>2. POST /api/rental-orders | status=400, có errors array | None | PASS | 2024-12-13 | MSW |
| CONTRACT-005 | Error 401 - orders | Xử lý unauthorized access | 1. Sử dụng unauthorizedHandlers<br>2. GET /api/rental-orders | status=401, message chứa "Unauthorized" | None | PASS | 2024-12-13 | MSW |
| CONTRACT-006 | Error 401 - profile | Xử lý unauthorized user profile | 1. Sử dụng unauthorizedHandlers<br>2. GET /api/users/me | status=401 | None | PASS | 2024-12-13 | MSW |
| CONTRACT-007 | Error 500 - server | Xử lý server error | 1. Sử dụng serverErrorHandlers<br>2. GET /api/device-models | status=500, message="Internal server error" | None | PASS | 2024-12-13 | MSW |
| CONTRACT-008 | Empty - device models | Xử lý empty device list | 1. Sử dụng emptyDataHandlers<br>2. GET /api/device-models | status=200, content=[], totalElements=0 | None | PASS | 2024-12-13 | MSW |
| CONTRACT-009 | Empty - orders | Xử lý empty orders list | 1. Sử dụng emptyDataHandlers<br>2. GET /api/rental-orders | status=200, array rỗng | None | PASS | 2024-12-13 | MSW |

---

## 5. Component Logic Tests (example-component.test.tsx)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| COMP-001 | Button state - disabled | Trả về "disabled" khi disabled=true | 1. Gọi calculateButtonState(true, false) | "disabled" | None | PASS | 2024-12-13 | |
| COMP-002 | Button state - disabled+pressed | Disabled ưu tiên hơn pressed | 1. Gọi calculateButtonState(true, true) | "disabled" | None | PASS | 2024-12-13 | |
| COMP-003 | Button state - pressed | Trả về "pressed" khi pressed | 1. Gọi calculateButtonState(false, true) | "pressed" | None | PASS | 2024-12-13 | |
| COMP-004 | Button state - default | Trả về "default" khi không pressed/disabled | 1. Gọi calculateButtonState(false, false) | "default" | None | PASS | 2024-12-13 | |
| COMP-005 | Title format - loading | Thêm ellipsis khi loading | 1. Gọi formatButtonTitle("Submit", true) | "Submit..." | None | PASS | 2024-12-13 | |
| COMP-006 | Title format - not loading | Giữ nguyên title khi không loading | 1. Gọi formatButtonTitle("Submit", false) | "Submit" | None | PASS | 2024-12-13 | |
| COMP-007 | Conditional render - show | Hiển thị khi condition=true và items tồn tại | 1. Gọi shouldShowElement(true, [1,2,3]) | true | None | PASS | 2024-12-13 | |
| COMP-008 | Conditional render - hide condition | Ẩn khi condition=false | 1. Gọi shouldShowElement(false, [1,2,3]) | false | None | PASS | 2024-12-13 | |
| COMP-009 | Conditional render - hide empty | Ẩn khi items rỗng | 1. Gọi shouldShowElement(true, []) | false | None | PASS | 2024-12-13 | |

---

## Summary - Automated Tests

| Category | Total Test Cases | Passed | Failed |
|----------|-----------------|--------|--------|
| Date Utilities | 25 | 25 | 0 |
| Cart Store | 19 | 19 | 0 |
| API Utilities | 14 | 14 | 0 |
| API Contract | 9 | 9 | 0 |
| Component Logic | 8 | 8 | 0 |
| **TOTAL AUTOMATED** | **75** | **75** | **0** |

---

# MANUAL TESTING

## Manual Test Function List

| No | Function Name | Sheet Name | Description | Pre-Condition |
|----|---------------|------------|-------------|---------------|
| 6 | Authentication | AUTH | Đăng nhập, đăng ký, OTP | App installed, network connected |
| 7 | Home Screen | HOME | Hiển thị sản phẩm, navigation | User logged in |
| 8 | Search | SEARCH | Tìm kiếm, filter sản phẩm | User logged in |
| 9 | Product Details | PRODUCT | Xem chi tiết, thêm vào giỏ | User logged in |
| 10 | Cart | CART | Quản lý giỏ hàng | User logged in, có sản phẩm |
| 11 | Checkout | CHECKOUT | Đặt hàng, chọn địa chỉ | User logged in, giỏ có items |
| 12 | Payment | PAYMENT | Thanh toán VNPay | Order created |
| 13 | Orders | ORDERS | Xem đơn hàng, chi tiết | User logged in |
| 14 | KYC | KYC | Xác thực danh tính | User logged in |
| 15 | Profile | PROFILE | Thông tin cá nhân | User logged in |
| 16 | Notifications | NOTIF | Thông báo | User logged in |

---

## 6. Authentication (AUTH)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| AUTH-001 | Sign In - valid | Đăng nhập thành công | 1. Mở app<br>2. Nhập email/password hợp lệ<br>3. Nhấn Sign In | Redirect tới Home screen | None | | | |
| AUTH-002 | Sign In - invalid email | Đăng nhập với email sai | 1. Nhập email không tồn tại<br>2. Nhấn Sign In | Hiển thị lỗi "Invalid credentials" | None | | | |
| AUTH-003 | Sign In - invalid password | Đăng nhập với password sai | 1. Nhập email đúng, password sai<br>2. Nhấn Sign In | Hiển thị lỗi "Invalid credentials" | None | | | |
| AUTH-004 | Sign In - empty fields | Đăng nhập với field trống | 1. Để trống email/password<br>2. Nhấn Sign In | Hiển thị validation error | None | | | |
| AUTH-005 | Sign Up - valid | Đăng ký tài khoản mới | 1. Nhấn Sign Up<br>2. Điền đầy đủ thông tin<br>3. Submit | Redirect tới OTP screen | None | | | |
| AUTH-006 | Sign Up - existing email | Đăng ký với email đã tồn tại | 1. Nhập email đã có<br>2. Submit | Hiển thị lỗi "Email already exists" | None | | | |
| AUTH-007 | Sign Up - password mismatch | Password không khớp | 1. Nhập password và confirm khác nhau<br>2. Submit | Hiển thị lỗi "Passwords do not match" | None | | | |
| AUTH-008 | OTP - valid | Xác thực OTP đúng | 1. Nhập OTP nhận được<br>2. Submit | Đăng ký thành công, redirect Home | AUTH-005 | | | |
| AUTH-009 | OTP - invalid | Xác thực OTP sai | 1. Nhập OTP sai<br>2. Submit | Hiển thị lỗi "Invalid OTP" | AUTH-005 | | | |
| AUTH-010 | OTP - resend | Gửi lại OTP | 1. Nhấn Resend OTP<br>2. Đợi countdown | OTP mới được gửi | AUTH-005 | | | |
| AUTH-011 | Logout | Đăng xuất | 1. Vào Profile<br>2. Nhấn Logout | Redirect tới Sign In screen | AUTH-001 | | | |

---

## 7. Home Screen (HOME)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| HOME-001 | Load products | Hiển thị danh sách sản phẩm | 1. Đăng nhập<br>2. Vào Home tab | Hiển thị grid sản phẩm | AUTH-001 | | | |
| HOME-002 | Product card | Hiển thị thông tin sản phẩm | 1. Xem product card | Có hình ảnh, tên, giá | HOME-001 | | | |
| HOME-003 | Navigate to details | Chuyển tới chi tiết | 1. Nhấn vào product card | Mở Product Details screen | HOME-001 | | | |
| HOME-004 | Pull to refresh | Làm mới danh sách | 1. Kéo xuống để refresh | Loading indicator, danh sách cập nhật | HOME-001 | | | |
| HOME-005 | Empty state | Không có sản phẩm | 1. API trả về empty | Hiển thị empty message | HOME-001 | | | |
| HOME-006 | Error state | Lỗi load sản phẩm | 1. Tắt mạng<br>2. Refresh | Hiển thị error message, retry button | HOME-001 | | | |

---

## 8. Search (SEARCH)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| SEARCH-001 | Search by name | Tìm theo tên | 1. Vào Search tab<br>2. Nhập keyword | Hiển thị kết quả matching | AUTH-001 | | | |
| SEARCH-002 | Search empty | Không có kết quả | 1. Tìm keyword không tồn tại | Hiển thị "No results found" | AUTH-001 | | | |
| SEARCH-003 | Filter by brand | Lọc theo thương hiệu | 1. Mở brand filter<br>2. Chọn brand | Chỉ hiển thị sản phẩm của brand | SEARCH-001 | | | |
| SEARCH-004 | Filter by category | Lọc theo category | 1. Mở category filter<br>2. Chọn category | Chỉ hiển thị sản phẩm của category | SEARCH-001 | | | |
| SEARCH-005 | Clear filters | Xóa bộ lọc | 1. Có filters active<br>2. Nhấn Clear | Filters reset, hiển thị tất cả | SEARCH-003 | | | |
| SEARCH-006 | Load more | Tải thêm kết quả | 1. Scroll xuống cuối<br>2. Nhấn Load More | Tải thêm sản phẩm | SEARCH-001 | | | |

---

## 9. Product Details (PRODUCT)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| PRODUCT-001 | View details | Xem chi tiết sản phẩm | 1. Nhấn vào product | Hiển thị đầy đủ: hình, tên, giá, mô tả, specs | HOME-003 | | | |
| PRODUCT-002 | Image gallery | Xem nhiều hình | 1. Swipe hình ảnh | Chuyển giữa các hình | PRODUCT-001 | | | |
| PRODUCT-003 | Select quantity | Chọn số lượng | 1. Tăng/giảm quantity | Quantity thay đổi, không vượt stock | PRODUCT-001 | | | |
| PRODUCT-004 | Select dates | Chọn ngày thuê | 1. Nhấn date picker<br>2. Chọn start/end date | Dates được chọn, tính số ngày | PRODUCT-001 | | | |
| PRODUCT-005 | Add to cart | Thêm vào giỏ | 1. Chọn quantity, dates<br>2. Nhấn Add to Cart | Toast "Added to cart", cart badge update | PRODUCT-003 | | | |
| PRODUCT-006 | Out of stock | Hết hàng | 1. Xem product stock=0 | Hiển thị "Out of Stock", disable Add button | PRODUCT-001 | | | |
| PRODUCT-007 | View specs | Xem thông số | 1. Nhấn View Specs | Mở modal hiển thị specs | PRODUCT-001 | | | |

---

## 10. Cart (CART-MANUAL)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| CART-M001 | View cart | Xem giỏ hàng | 1. Nhấn Cart tab | Hiển thị danh sách items, tổng tiền | PRODUCT-005 | | | |
| CART-M002 | Update quantity | Thay đổi số lượng | 1. Tăng/giảm quantity item | Quantity update, tổng tiền recalculate | CART-M001 | | | |
| CART-M003 | Remove item | Xóa item | 1. Swipe item<br>2. Nhấn Delete | Item bị xóa, list update | CART-M001 | | | |
| CART-M004 | Empty cart | Giỏ trống | 1. Xóa hết items | Hiển thị empty state | CART-M001 | | | |
| CART-M005 | Proceed checkout | Tiến hành checkout | 1. Nhấn Proceed to Checkout | Navigate tới Checkout screen | CART-M001 | | | |
| CART-M006 | Price calculation | Tính giá thuê | 1. Thêm items với dates khác nhau | Tổng tiền = sum(price × days × qty) | CART-M001 | | | |

---

## 11. Checkout (CHECKOUT)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| CHECKOUT-001 | View summary | Xem tóm tắt đơn hàng | 1. Vào Checkout | Hiển thị items, địa chỉ, tổng tiền | CART-M005 | | | |
| CHECKOUT-002 | Select address | Chọn địa chỉ giao | 1. Nhấn chọn địa chỉ<br>2. Chọn address | Address được chọn | CHECKOUT-001 | | | |
| CHECKOUT-003 | Add new address | Thêm địa chỉ mới | 1. Nhấn Add Address<br>2. Điền thông tin<br>3. Save | Address mới được thêm | CHECKOUT-001 | | | |
| CHECKOUT-004 | Place order | Đặt hàng | 1. Có address, items<br>2. Nhấn Place Order | Order created, navigate Payment | CHECKOUT-002 | | | |
| CHECKOUT-005 | No address | Không có địa chỉ | 1. Checkout khi chưa có address | Hiển thị message "Please add address" | CHECKOUT-001 | | | |
| CHECKOUT-006 | Order summary | Xem chi tiết giá | 1. Xem breakdown | Hiển thị: Rental fee, Deposit, Total | CHECKOUT-001 | | | |

---

## 12. Payment (PAYMENT)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| PAYMENT-001 | VNPay redirect | Chuyển tới VNPay | 1. Place order<br>2. Chọn VNPay | Mở WebView VNPay | CHECKOUT-004 | | | |
| PAYMENT-002 | VNPay success | Thanh toán thành công | 1. Hoàn thành payment trên VNPay | Redirect về app, hiển thị success | PAYMENT-001 | | | |
| PAYMENT-003 | VNPay cancel | Hủy thanh toán | 1. Nhấn Cancel trên VNPay | Redirect về app, hiển thị cancelled | PAYMENT-001 | | | |
| PAYMENT-004 | VNPay failed | Thanh toán thất bại | 1. Payment failed (insufficient funds) | Redirect về app, hiển thị failed | PAYMENT-001 | | | |
| PAYMENT-005 | View payment result | Xem kết quả | 1. Sau payment | Hiển thị trạng thái, order details | PAYMENT-001 | | | |
| PAYMENT-006 | Retry payment | Thanh toán lại | 1. Payment failed<br>2. Nhấn Retry | Mở lại VNPay | PAYMENT-004 | | | |

---

## 13. Orders (ORDERS)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| ORDERS-001 | View orders | Xem danh sách đơn hàng | 1. Vào Orders tab | Hiển thị list orders | AUTH-001 | | | |
| ORDERS-002 | Order status | Xem trạng thái | 1. Xem order card | Hiển thị status badge (Pending, Paid, etc.) | ORDERS-001 | | | |
| ORDERS-003 | Order details | Xem chi tiết đơn | 1. Nhấn vào order | Mở modal chi tiết: items, dates, payment | ORDERS-001 | | | |
| ORDERS-004 | Filter by status | Lọc theo trạng thái | 1. Chọn status filter | Chỉ hiển thị orders matching status | ORDERS-001 | | | |
| ORDERS-005 | Cancel order | Hủy đơn hàng | 1. Order status = Pending<br>2. Nhấn Cancel | Order cancelled | ORDERS-003 | | | |
| ORDERS-006 | View contract | Xem hợp đồng | 1. Order có contract<br>2. Nhấn View Contract | Mở PDF contract | ORDERS-003 | | | |
| ORDERS-007 | Sign handover | Ký biên bản giao nhận | 1. Order status = Delivery<br>2. Nhấn Sign | Mở signature screen | ORDERS-003 | | | |
| ORDERS-008 | Empty orders | Không có đơn hàng | 1. User mới, chưa có orders | Hiển thị empty state | ORDERS-001 | | | |
| ORDERS-009 | Refresh orders | Làm mới danh sách | 1. Pull to refresh | Orders list updated | ORDERS-001 | | | |

---

## 14. KYC Verification (KYC)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| KYC-001 | View KYC status | Xem trạng thái xác thực | 1. Vào Profile<br>2. Nhấn KYC Verification | Hiển thị status: Not started/Pending/Approved | AUTH-001 | | | |
| KYC-002 | Upload front ID | Upload mặt trước CCCD | 1. Nhấn Upload Front<br>2. Chọn/chụp ảnh | Ảnh được upload, hiển thị preview | KYC-001 | | | |
| KYC-003 | Upload back ID | Upload mặt sau CCCD | 1. Nhấn Upload Back<br>2. Chọn/chụp ảnh | Ảnh được upload, hiển thị preview | KYC-002 | | | |
| KYC-004 | OCR extraction | Trích xuất thông tin | 1. Upload xong cả 2 mặt | Tự động điền thông tin từ OCR | KYC-003 | | | |
| KYC-005 | Edit details | Chỉnh sửa thông tin | 1. Sửa thông tin OCR<br>2. Save | Thông tin được cập nhật | KYC-004 | | | |
| KYC-006 | Submit KYC | Gửi xác thực | 1. Điền đầy đủ thông tin<br>2. Submit | Status = Pending, đợi duyệt | KYC-005 | | | |
| KYC-007 | KYC approved | Xác thực thành công | 1. Admin approve | Status = Approved | KYC-006 | | | |
| KYC-008 | KYC rejected | Xác thực bị từ chối | 1. Admin reject | Status = Rejected, hiển thị lý do | KYC-006 | | | |

---

## 15. Profile (PROFILE)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| PROFILE-001 | View profile | Xem thông tin cá nhân | 1. Vào Profile tab | Hiển thị avatar, name, email, phone | AUTH-001 | | | |
| PROFILE-002 | Update profile | Cập nhật thông tin | 1. Nhấn Edit Profile<br>2. Sửa thông tin<br>3. Save | Thông tin được cập nhật | PROFILE-001 | | | |
| PROFILE-003 | Change avatar | Đổi ảnh đại diện | 1. Nhấn avatar<br>2. Chọn ảnh mới | Avatar được cập nhật | PROFILE-001 | | | |
| PROFILE-004 | Manage addresses | Quản lý địa chỉ | 1. Nhấn Shipping Addresses | Hiển thị danh sách địa chỉ | PROFILE-001 | | | |
| PROFILE-005 | Add address | Thêm địa chỉ mới | 1. Nhấn Add Address<br>2. Điền thông tin | Địa chỉ được thêm | PROFILE-004 | | | |
| PROFILE-006 | Delete address | Xóa địa chỉ | 1. Swipe address<br>2. Nhấn Delete | Địa chỉ bị xóa | PROFILE-004 | | | |
| PROFILE-007 | Set default | Đặt địa chỉ mặc định | 1. Nhấn Set Default | Địa chỉ được đánh dấu default | PROFILE-004 | | | |

---

## 16. Notifications (NOTIF)

| Test Case ID | Test Case | Description | Test Case Procedure | Expected Results | Inter-test case Dependence | Result | Test Date | Note |
|--------------|-----------|-------------|---------------------|------------------|---------------------------|--------|-----------|------|
| NOTIF-001 | View notifications | Xem thông báo | 1. Nhấn Notifications | Hiển thị danh sách thông báo | AUTH-001 | | | |
| NOTIF-002 | Unread badge | Badge số chưa đọc | 1. Có notification mới | Badge hiển thị số lượng | AUTH-001 | | | |
| NOTIF-003 | Mark as read | Đánh dấu đã đọc | 1. Nhấn vào notification | Notification được đánh dấu đã đọc | NOTIF-001 | | | |
| NOTIF-004 | Navigate from notif | Điều hướng từ thông báo | 1. Nhấn order notification | Navigate tới Order Details | NOTIF-001 | | | |
| NOTIF-005 | Empty notifications | Không có thông báo | 1. User mới, chưa có notif | Hiển thị empty state | NOTIF-001 | | | |
| NOTIF-006 | Pull to refresh | Làm mới thông báo | 1. Pull to refresh | Notifications list updated | NOTIF-001 | | | |

---

## Summary - All Tests

| Category | Type | Total Test Cases | Passed | Failed |
|----------|------|-----------------|--------|--------|
| Date Utilities | Automated | 25 | 25 | 0 |
| Cart Store | Automated | 19 | 19 | 0 |
| API Utilities | Automated | 14 | 14 | 0 |
| API Contract | Automated | 9 | 9 | 0 |
| Component Logic | Automated | 8 | 8 | 0 |
| **Subtotal Automated** | | **75** | **75** | **0** |
| Authentication | Manual | 11 | - | - |
| Home Screen | Manual | 6 | - | - |
| Search | Manual | 6 | - | - |
| Product Details | Manual | 7 | - | - |
| Cart | Manual | 6 | - | - |
| Checkout | Manual | 6 | - | - |
| Payment | Manual | 6 | - | - |
| Orders | Manual | 9 | - | - |
| KYC | Manual | 8 | - | - |
| Profile | Manual | 7 | - | - |
| Notifications | Manual | 6 | - | - |
| **Subtotal Manual** | | **78** | **-** | **-** |
| **GRAND TOTAL** | | **153** | | |
