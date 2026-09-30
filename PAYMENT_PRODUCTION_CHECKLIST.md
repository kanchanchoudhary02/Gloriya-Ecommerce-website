# Razorpay + Receipt Production Checklist

1. Rotate the previously exposed Razorpay secret in the Razorpay Dashboard.
2. Set the NEW secret only in the backend production environment as `RAZORPAY_KEY_SECRET`. Never commit `.env`.
3. Set `RAZORPAY_KEY_ID` to the matching LIVE key ID.
4. Set `MONGODB_URI`, `SESSION_SECRET`, `RESEND_API_KEY`, and a verified `MAIL_FROM`.
5. Set `SITE_ORIGIN=https://gloriya.in` and `CORS_ORIGIN=https://gloriya.in`.
6. Set frontend `VITE_API_BASE=https://gloriya.in/api`.
7. Restart/redeploy the backend after changing environment variables.
8. Test a small real payment from a registered customer account.
9. After successful payment: the order is marked completed, inventory is reduced once, the receipt is emailed to the registered email, and My Account > Orders shows `View Your Bill`.
10. Failed/cancelled payments keep the cart intact.