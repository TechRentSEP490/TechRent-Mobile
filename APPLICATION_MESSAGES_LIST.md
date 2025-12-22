# Application Messages List - TechRent Mobile App

## Mục Lục
1. [Authentication Messages](#1-authentication-messages)
2. [Cart & Checkout Messages](#2-cart--checkout-messages)
3. [Orders & Payment Messages](#3-orders--payment-messages)
4. [KYC Verification Messages](#4-kyc-verification-messages)
5. [Profile & Settings Messages](#5-profile--settings-messages)
6. [Shipping Addresses Messages](#6-shipping-addresses-messages)
7. [Notifications Messages](#7-notifications-messages)
8. [Documents & Downloads Messages](#8-documents--downloads-messages)
9. [Rental Expiry Messages](#9-rental-expiry-messages)
10. [Product Details Messages](#10-product-details-messages)
11. [Handover Signing Messages](#11-handover-signing-messages)

---

## 1. Authentication Messages

### File: `app/(auth)/sign-up.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| AUTH-001 | 55-58 | Alert | Registration successful | Enter the verification code we emailed to you. | `Alert.alert(result.message ?? 'Registration successful', result.details ?? 'Enter the verification code we emailed to you.')` |
| AUTH-002 | 65 | Error | — | Unable to create your account. | `const message = error instanceof Error ? error.message : 'Unable to create your account.'` |

### File: `app/(auth)/otp.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| AUTH-003 | 69 | Alert | Email verified | You can now sign in to your account. | `Alert.alert('Email verified', 'You can now sign in to your account.')` |
| AUTH-004 | 56 | Error | — | Missing email verification details. Please sign up again. | `setErrorMessage('Missing email verification details. Please sign up again.')` |
| AUTH-005 | 72 | Error | — | Verification failed. Please try again. | `const message = error instanceof Error ? error.message : 'Verification failed. Please try again.'` |

### File: `app/(auth)/sign-in.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| AUTH-006 | 26-27 | Error | — | Please enter your email or username and password. | `setErrorMessage('Please enter your email or username and password.')` |
| AUTH-007 | 35 | Error | — | Unable to sign in. Please try again. | `const message = error instanceof Error ? error.message : 'Unable to sign in. Please try again.'` |

---

## 2. Cart & Checkout Messages

### File: `app/(app)/cart.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| CART-001 | 411 | Alert | Authentication required | Please sign in again to complete your rental. | `Alert.alert('Authentication required', 'Please sign in again to complete your rental.')` |
| CART-002 | 424 | Error | — | Unable to determine one or more selected devices. Please try again. | `setSubmitError('Unable to determine one or more selected devices. Please try again.')` |
| CART-003 | 479-491 | Alert | Rental order created | Your rental order was submitted successfully. We'll keep you posted with updates. | `Alert.alert('Rental order created', "Your rental order was submitted successfully...")` |
| CART-004 | 493-494 | Error | — | Unable to create the rental order. Please try again. | `const message = error instanceof Error ? error.message : 'Unable to create the rental order. Please try again.'` |
| CART-005 | 456-474 | Alert | Complete your KYC | Your rental order is pending identity verification. Would you like to finish your KYC now? | `Alert.alert('Complete your KYC', 'Your rental order is pending identity verification...')` |
| CART-006 | 175-179 | Toast | Shipping address selected | We will deliver your rental order to this location. | `Toast.show({ type: 'success', text1: 'Shipping address selected', text2: 'We will deliver your rental order to this location.' })` |
| CART-007 | 158 | Toast | Unable to refresh addresses | Failed to refresh your shipping addresses. Please try again later. | `Toast.show({ type: 'error', text1: 'Unable to refresh addresses', text2: message })` |
| CART-008 | 129-130 | Error | — | Failed to load your shipping addresses. Please try again later. | `const message = error instanceof Error ? error.message : 'Failed to load your shipping addresses...'` |
| CART-009 | 779 | Error | — | End date must be at least one day after the start date. | `<Text style={styles.dateErrorText}>End date must be at least one day after the start date.</Text>` |

---

## 3. Orders & Payment Messages

### File: `app/(app)/(tabs)/orders.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| ORD-001 | 1059 | Error | — | Invalid rental order selected. | `setContractErrorMessage('Invalid rental order selected.')` |
| ORD-002 | 1113 | Error | — | No rental contract is available for this order yet. | `setContractErrorMessage('No rental contract is available for this order yet.')` |
| ORD-003 | 1097 | Error | — | You must be signed in to view rental contracts. | `throw new Error('You must be signed in to view rental contracts.')` |
| ORD-004 | 1125-1127 | Error | — | Your session has expired. Please sign in again to view the rental contract. | `setContractErrorMessage('Your session has expired. Please sign in again...')` |
| ORD-005 | 1120 | Error | — | Failed to load rental contract. Please try again. | `const fallbackMessage = 'Failed to load rental contract. Please try again.'` |
| ORD-006 | 1291 | Alert | Unable to send code | Unable to send the verification code. Please try again. | `Alert.alert('Unable to send code', message)` |
| ORD-007 | 1329-1333 | Alert | Verification code sent | We sent a new verification code to {email}. Please check your inbox. | `Alert.alert('Verification code sent', response?.details ?? ...)` |
| ORD-008 | 1341 | Alert | Unable to resend code | Unable to resend the verification code. Please try again. | `Alert.alert('Unable to resend code', message)` |
| ORD-009 | 1366 | Error | — | Please enter the complete 6-digit verification code. | `setVerificationError('Please enter the complete 6-digit verification code.')` |
| ORD-010 | 1371 | Error | — | A rental contract is required to complete the signature. | `setVerificationError('A rental contract is required to complete the signature.')` |
| ORD-011 | 1398 | Error | — | Unable to verify the code. Please try again. | `const fallbackMessage = 'Unable to verify the code. Please try again.'` |
| ORD-012 | 1265 | Error | — | Email is required to receive the verification code. | `setEmailEditorError('Email is required to receive the verification code.')` |
| ORD-013 | 1272 | Error | — | Please enter a valid email address. | `setEmailEditorError('Please enter a valid email address.')` |
| ORD-014 | 1434 | Error | — | Email is required. | `setEmailEditorError('Email is required.')` |
| ORD-015 | 1457 | Alert | Payment unavailable | Select an order before continuing to payment. | `Alert.alert('Payment unavailable', 'Select an order before continuing to payment.')` |
| ORD-016 | 1473 | Error | — | You must be signed in to continue with payment. | `throw new Error('You must be signed in to continue with payment.')` |
| ORD-017 | 1479 | Error | — | Unable to determine the total amount due for this order. | `throw new Error('Unable to determine the total amount due for this order.')` |
| ORD-018 | 1527 | Error | — | The payment provider did not return a checkout link. | `throw new Error('The payment provider did not return a checkout link.')` |
| ORD-019 | 1548 | Alert | Payment unavailable | Unable to create the payment link. Please try again later. | `Alert.alert('Payment unavailable', message)` |
| ORD-020 | 1577-1580 | Alert | Unable to open link | We could not open the checkout page in the browser. Please try again later. | `Alert.alert('Unable to open link', 'We could not open the checkout page...')` |
| ORD-021 | 1708 | Alert | Extend Rental | Our team will reach out to help extend this rental. | `Alert.alert('Extend Rental', 'Our team will reach out to help extend this rental.')` |
| ORD-022 | 1711 | Alert | Receipt Confirmed | Thanks for confirming delivery of your device. | `Alert.alert('Receipt Confirmed', 'Thanks for confirming delivery of your device.')` |
| ORD-023 | 1714 | Alert | Cancel Order | Your cancellation request has been submitted. | `Alert.alert('Cancel Order', 'Your cancellation request has been submitted.')` |
| ORD-024 | 1717 | Alert | Rent Again | We'll move this device to your cart so you can rent it again. | `Alert.alert('Rent Again', 'We\\'ll move this device to your cart so you can rent it again.')` |
| ORD-025 | 1856 | Alert | Order unavailable | Unable to load details for this rental order. | `Alert.alert('Order unavailable', 'Unable to load details for this rental order.')` |
| ORD-026 | 649 | Alert | Lỗi | Không thể tải PDF. Vui lòng thử lại. | `Alert.alert('Lỗi', 'Không thể tải PDF. Vui lòng thử lại.')` |

---

## 4. KYC Verification Messages

### File: `app/(app)/kyc-documents.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| KYC-001 | 166-169 | Alert | Camera permission required | Please enable permissions in your device settings to continue. | `Alert.alert('Camera permission required', 'Please enable permissions...')` |
| KYC-002 | 166-169 | Alert | Photo library permission required | Please enable permissions in your device settings to continue. | `Alert.alert('Photo library permission required', 'Please enable permissions...')` |
| KYC-003 | 293-312 | Alert | Upload document | Choose how you would like to add this photo. | `Alert.alert('Upload document', 'Choose how you would like to add this photo.', [...])` |
| KYC-004 | 319 | Alert | Missing documents | Please provide all three required photos to continue. | `Alert.alert('Missing documents', 'Please provide all three required photos to continue.')` |
| KYC-010 | 126 | Status | Photo ready | — | `<Text style={[styles.statusText, styles.successText]}>Photo ready</Text>` |
| KYC-011 | 116 | Status | Processing text… | — | `<Text style={styles.statusText}>Processing text…</Text>` |
| KYC-012 | 235 | Error | — | Could not extract text. You can fill details manually later. | `const fallbackMessage = 'Could not extract text. You can fill details manually later.'` |

### File: `app/(app)/kyc-details.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| KYC-005 | 138 | Alert | Missing documents | We could not find all required document photos. Please go back and try again. | `Alert.alert('Missing documents', 'We could not find all required document photos...')` |
| KYC-006 | 154 | Alert | Authentication required | Please sign in again to submit your documents. | `Alert.alert('Authentication required', 'Please sign in again to submit your documents.')` |
| KYC-007 | 172-184 | Alert | KYC submitted | Your documents were uploaded successfully. We will notify you once the review is complete. | `Alert.alert('KYC submitted', response?.message || 'Your documents were uploaded successfully...')` |
| KYC-008 | 143 | Error | — | Please complete all required fields before submitting. | `setErrorMessage('Please complete all required fields before submitting.')` |
| KYC-009 | 187 | Error | — | Failed to upload KYC documents. | `const message = error instanceof Error ? error.message : 'Failed to upload KYC documents.'` |

---

## 5. Profile & Settings Messages

### File: `app/(app)/update-profile.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| PROF-001 | 104-108 | Toast | Profile updated | Your account details have been saved successfully. | `Toast.show({ type: 'success', text1: 'Profile updated', text2: 'Your account details have been saved successfully.' })` |
| PROF-002 | 114 | Toast | Update failed | We were unable to update your profile. Please try again. | `Toast.show({ type: 'error', text1: 'Update failed', text2: message })` |
| PROF-003 | 63 | Validation | — | Full name is required. | `errors.fullName = 'Full name is required.'` |
| PROF-004 | 67 | Validation | — | Email is required. | `errors.email = 'Email is required.'` |
| PROF-005 | 69 | Validation | — | Enter a valid email address. | `errors.email = 'Enter a valid email address.'` |
| PROF-006 | 73 | Validation | — | Phone number is required. | `errors.phoneNumber = 'Phone number is required.'` |
| PROF-007 | 75 | Validation | — | Enter a valid phone number. | `errors.phoneNumber = 'Enter a valid phone number.'` |
| PROF-008 | 125 | Display | — | You need to be signed in | `<Text style={styles.emptyStateTitle}>You need to be signed in</Text>` |

### File: `app/(app)/(tabs)/profile.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| PROF-009 | varies | Display | — | Thank you! Your documents were submitted and are awaiting review. | `description: 'Thank you! Your documents were submitted and are awaiting review.'` |

---

## 6. Shipping Addresses Messages

### File: `app/(app)/shipping-addresses.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| ADDR-001 | 188-191 | Toast | Address added | Your new shipping address has been saved. | `Toast.show({ type: 'success', text1: 'Address added', text2: 'Your new shipping address has been saved.' })` |
| ADDR-002 | 205 | Toast | Add address failed | We were unable to add your shipping address. Please try again later. | `Toast.show({ type: 'error', text1: 'Add address failed', text2: message })` |
| ADDR-003 | 241-244 | Toast | Address deleted | The shipping address has been deleted. | `Toast.show({ type: 'success', text1: 'Address deleted', text2: 'The shipping address has been deleted.' })` |
| ADDR-004 | 257 | Toast | Delete address failed | We were unable to delete the shipping address. Please try again later. | `Toast.show({ type: 'error', text1: 'Delete address failed', text2: message })` |
| ADDR-005 | 147 | Toast | Unable to refresh addresses | Failed to refresh your shipping addresses. Please try again later. | `Toast.show({ type: 'error', text1: 'Unable to refresh addresses', text2: message })` |
| ADDR-006 | varies | Error | — | Please sign in again to add a shipping address. | `throw new Error('Please sign in again to add a shipping address.')` |
| ADDR-007 | varies | Error | — | Please sign in again to remove this address. | `throw new Error('Please sign in again to remove this address.')` |
| ADDR-008 | 213-225 | Alert | Delete Address | Are you sure you want to delete this address? | `Alert.alert('Delete Address', 'Are you sure you want to delete this address?', [...])` |

---

## 7. Notifications Messages

### File: `app/(app)/notifications.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| NOTIF-001 | 449 | Alert | Notifications | {dynamic message content} | `Alert.alert('Notifications', message)` |
| NOTIF-002 | 523 | Alert | Notification | Additional handling for this notification is coming soon. | `Alert.alert('Notification', 'Additional handling for this notification is coming soon.')` |

---

## 8. Documents & Downloads Messages

### File: `components/ContractPdfDownloader.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| DOC-001 | 402 | Alert | Download contract | Contract details are unavailable. Please try again later. | `Alert.alert('Download contract', 'Contract details are unavailable. Please try again later.')` |
| DOC-002 | 485-505 | Alert | Download contract | {error message or fallback} | `Alert.alert('Download contract', normalizedError.message && normalizedError.message.trim().length > 0 ? normalizedError.message : fallbackMessage)` |

### File: `components/HandoverPdfDownloader.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| DOC-003 | 42 | Alert | Tải biên bản | Không có thông tin biên bản. Vui lòng thử lại. | `Alert.alert('Tải biên bản', 'Không có thông tin biên bản. Vui lòng thử lại.')` |
| DOC-004 | 91-106 | Alert | Lỗi tải biên bản | {error message or fallback} | `Alert.alert('Lỗi tải biên bản', normalizedError.message && normalizedError.message.trim().length > 0 ? normalizedError.message : fallbackMessage)` |

---

## 9. Rental Expiry Messages

### File: `components/modals/RentalExpiryModal.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| EXP-001 | varies | Display | — | Đã quá hạn | `if (daysRemaining < 0) return 'Đã quá hạn'` |
| EXP-002 | varies | Display | — | Hết hạn hôm nay | `if (daysRemaining === 0) return 'Hết hạn hôm nay'` |
| EXP-003 | varies | Display | — | Còn 1 ngày | `if (daysRemaining === 1) return 'Còn 1 ngày'` |
| EXP-004 | varies | Display | — | Còn {X} ngày | `return \`Còn ${daysRemaining} ngày\`` |

---

## 10. Product Details Messages

### File: `app/(app)/product-details.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| PROD-001 | 398-404 | Toast | Added to cart | {quantity} units of {product.name} are now in your cart. | `Toast.show({ type: 'success', text1: 'Added to cart', text2: isMultiple ? \`${quantity} units of ${product.name} are now in your cart.\` : ... })` |
| PROD-002 | 398-404 | Toast | Added to cart | {product.name} is now in your cart. | `Toast.show({ type: 'success', text1: 'Added to cart', text2: ... : \`${product.name} is now in your cart.\` })` |
| PROD-003 | 301 | Display | — | Device not found. | `<Text style={styles.errorBannerText}>Device not found.</Text>` |

---

## 11. Handover Signing Messages

### File: `components/modals/HandoverSignModal.tsx`

| ID | Line | Type | Title | Message | Code Snippet |
|:---|:-----|:-----|:------|:--------|:-------------|
| HAND-001 | varies | Display | — | Để xác nhận ký biên bản, chúng tôi sẽ gửi mã PIN xác thực đến email của bạn. | `<Text style={styles.description}>Để xác nhận ký biên bản, chúng tôi sẽ gửi mã PIN xác thực đến email của bạn.</Text>` |

---

## Summary Statistics

| Category | Total Messages |
|:---------|---------------:|
| Authentication | 7 |
| Cart & Checkout | 9 |
| Orders & Payment | 26 |
| KYC Verification | 12 |
| Profile & Settings | 9 |
| Shipping Addresses | 8 |
| Notifications | 2 |
| Documents & Downloads | 4 |
| Rental Expiry | 4 |
| Product Details | 3 |
| Handover Signing | 1 |
| **Total** | **85** |

---

## Message Type Distribution

| Type | Count | Description |
|:-----|------:|:------------|
| Alert (Popup) | 35 | Native React Native Alert popups |
| Toast Success | 5 | Toast notification for success actions |
| Toast Error | 6 | Toast notification for error states |
| Error Display | 15 | Inline error message in UI |
| Validation | 5 | Form field validation messages |
| Display/Status | 19 | Static text displayed in UI |

---

*Document generated: December 14, 2025*  
*TechRent Mobile Application v1.0*
