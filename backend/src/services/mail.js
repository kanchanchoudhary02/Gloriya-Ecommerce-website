import { env } from "../config/env.js";
import crypto from "node:crypto";

/* =========================================================
   GLORIYA JEWELLERY - RESEND EMAIL SERVICE
   ========================================================= */

/**
 * Send email using Resend API
 *
 * Required .env:
 * RESEND_API_KEY=re_xxxxxxxxx
 * MAIL_FROM=orders@gloriya.in
 */

async function resendSend({
  subject,
  recipient,
  htmlBody = "",
  textBody = "",
  sender,
  replyTo,
  attachments = [],
}) {
  /* =========================================================
     BASIC VALIDATION
     ========================================================= */

  if (!env.RESEND_API_KEY) {
    console.error("\n========================================");
    console.error("❌ EMAIL FAILED");
    console.error("❗ RESEND_API_KEY is not configured");
    console.error("========================================\n");

    return {
      ok: false,
      error: "RESEND_API_KEY is not configured",
    };
  }

  if (!sender) {
    console.error("\n========================================");
    console.error("❌ EMAIL FAILED");
    console.error("❗ MAIL_FROM is not configured");
    console.error("========================================\n");

    return {
      ok: false,
      error: "MAIL_FROM is not configured",
    };
  }

  if (!recipient) {
    console.error("\n========================================");
    console.error("❌ EMAIL FAILED");
    console.error("❗ No recipient email provided");
    console.error("========================================\n");

    return {
      ok: false,
      error: "No recipient email provided",
    };
  }

  /* =========================================================
     TERMINAL LOG - EMAIL START
     ========================================================= */

  console.log("\n========================================");
  console.log("📤 SENDING EMAIL");
  console.log("========================================");
  console.log("📧 From:", sender);
  console.log("📩 To:", recipient);
  console.log("📝 Subject:", subject);
  console.log("========================================");

  let timeout;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,

      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        from: sender,
        to: [recipient],
        ...(replyTo ? { reply_to: [replyTo] } : {}),
        subject,
        html: htmlBody,
        text: textBody,
        ...(Array.isArray(attachments) && attachments.length ? { attachments } : {}),
      }),
    });

    clearTimeout(timeout);
    const data = await response.json().catch(() => ({}));

    /* =========================================================
       EMAIL FAILED
       ========================================================= */

    if (!response.ok) {
      console.error("\n========================================");
      console.error("❌ EMAIL FAILED");
      console.error("========================================");
      console.error("📧 From:", sender);
      console.error("📩 To:", recipient);
      console.error("📝 Subject:", subject);
      console.error("📊 Status:", response.status);
      console.error("❗ Error:", data?.message || data?.error || data);
      console.error("========================================\n");

      return {
        ok: false,
        error:
          data?.message ||
          data?.error ||
          `resend_status_${response.status}`,
        details: data,
      };
    }

    /* =========================================================
       EMAIL SUCCESS
       ========================================================= */

    console.log("\n========================================");
    console.log("✅ EMAIL SENT SUCCESSFULLY");
    console.log("========================================");
    console.log("📧 From:", sender);
    console.log("📩 To:", recipient);
    console.log("📝 Subject:", subject);
    console.log("🆔 Resend ID:", data?.id || "N/A");
    console.log("========================================\n");

    return {
      ok: true,
      provider: "resend",
      id: data?.id || null,
    };
  } catch (error) {
    if (timeout) clearTimeout(timeout);
    /* =========================================================
       REQUEST / NETWORK ERROR
       ========================================================= */

    console.error("\n========================================");
    console.error("❌ RESEND REQUEST FAILED");
    console.error("========================================");
    console.error("📧 From:", sender);
    console.error("📩 To:", recipient);
    console.error("📝 Subject:", subject);
    console.error("❗ Error:", error?.message || error);
    console.error("========================================\n");

    return {
      ok: false,
      error: String(error?.message || error),
    };
  }
}



function publicApiOrigin() {
  const configured = String(env.SITE_ORIGIN || "").trim().replace(/\/+$/, "");
  try {
    const u = new URL(configured);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("invalid protocol");
    if (!u.hostname) throw new Error("missing hostname");
    return `${u.origin}/api`;
  } catch {
    return "https://gloriya.in/api";
  }
}

function receiptDownloadUrl(order) {
  const orderId = order?.order_id || order?.id || "";
  const token = buildReceiptAccessToken(order);
  if (!orderId || !token) return "";
  return `${publicApiOrigin()}/orders/${encodeURIComponent(String(orderId))}/receipt?format=pdf&download=1&token=${encodeURIComponent(token)}`;
}

/* =========================================================
   GENERIC SEND EMAIL
   ========================================================= */

export async function sendEmail(
  subject,
  recipient,
  {
    htmlBody = "",
    textBody = "",
    sender,
    replyTo,
    attachments = [],
  } = {}
) {
  const from = sender || env.MAIL_FROM;

  if (!from || !recipient) {
    console.error("\n========================================");
    console.error("❌ EMAIL FAILED");
    console.error("========================================");
    console.error("❗ Sender or recipient is missing");
    console.error("From:", from || "MISSING");
    console.error("To:", recipient || "MISSING");
    console.error("========================================\n");

    return {
      ok: false,
      error: "no_sender_or_recipient",
    };
  }

  return resendSend({
    subject,
    recipient,
    htmlBody,
    textBody,
    sender: from,
    replyTo,
    attachments,
  });
}


/* =========================================================
   WELCOME EMAIL
   ========================================================= */

export async function sendWelcomeEmail(user) {
  const recipient = user?.email;
  const name = String(user?.name || "there");

  if (!recipient) {
    console.error("\n❌ WELCOME EMAIL FAILED");
    console.error("❗ User email is missing\n");

    return {
      ok: false,
      error: "no_recipient",
    };
  }

  return sendEmail(
    "Welcome to Gloriya Jewellery",
    recipient,
    {
      htmlBody: `
        <!doctype html>
        <html>
          <body style="font-family:Arial,sans-serif;color:#2b1e1c;">

            <h2>Welcome to Gloriya Jewellery</h2>

            <p>Hi ${name},</p>

            <p>
              Welcome to Gloriya Jewellery.
              Your account has been created successfully.
            </p>

            <p>
              Thank you for joining us.
            </p>

            <p>
              Regards,<br>
              <strong>Gloriya Jewellery</strong>
            </p>

          </body>
        </html>
      `,

      textBody: `
Hi ${name},

Welcome to Gloriya Jewellery.

Your account has been created successfully.

Thank you for joining us.

Regards,
Gloriya Jewellery
      `,
    }
  );
}


/* =========================================================
   RECEIPT HTML
   ========================================================= */

export function buildReceiptHtml(
  order,
  {
    shopCopy = false,
    downloadUrl = receiptDownloadUrl(order),
  } = {}
) {
  const items = Array.isArray(order?.items)
    ? order.items
    : [];

  const rows = items
    .map((it) => {
      const qty = Number(
        it?.qty ||
        it?.quantity ||
        1
      );

      const price = Number(
        it?.unit_price ??
        it?.price ??
        0
      );

      const line = Number(
        it?.line_total ??
        price * qty
      );

      return `
        <tr>

          <td style="
            padding:10px;
            border-bottom:1px solid #eee;
          ">
            ${String(it?.name || "Product")}
          </td>

          <td style="
            padding:10px;
            text-align:center;
            border-bottom:1px solid #eee;
          ">
            ${qty}
          </td>

          <td style="
            padding:10px;
            text-align:right;
            border-bottom:1px solid #eee;
          ">
            ₹${price.toFixed(2)}
          </td>

          <td style="
            padding:10px;
            text-align:right;
            border-bottom:1px solid #eee;
          ">
            ₹${line.toFixed(2)}
          </td>

        </tr>
      `;
    })
    .join("");


  const orderId =
    order?.order_id ||
    order?.id ||
    "N/A";


  const orderDate =
    order?.timestamp ||
    new Date().toLocaleString("en-IN");


  const status =
    order?.status ||
    "completed";


  const total =
    Number(order?.amount || 0).toFixed(2);


  const customerName =
    order?.name ||
    "";


  const customerEmail =
    order?.user_email ||
    order?.email ||
    "";


  const phone =
    order?.phone ||
    "";


  const address =
    order?.address ||
    "";


  const city =
    order?.city ||
    "";


  const pincode =
    order?.pincode ||
    "";


  return `
<!doctype html>

<html>

<head>

<meta charset="utf-8">

<meta name="viewport"
      content="width=device-width,initial-scale=1">

<title>
Gloriya Receipt #${orderId}
</title>

<style>

body {
  font-family: Arial, sans-serif;
  color: #2b1e1c;
  margin: 0;
  padding: 30px;
  background: #faf8f6;
}

.receipt {
  max-width: 760px;
  margin: auto;
  background: #ffffff;
  padding: 34px;
  border: 1px solid #eaded8;
}

.brand {
  font-size: 28px;
  font-weight: 700;
}

.muted {
  color: #777;
}

.total {
  font-size: 20px;
  font-weight: 700;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

th {
  text-align: left;
  padding: 10px;
  background: #f7efeb;
}

.info-box {
  background: #faf5f2;
  padding: 15px;
  margin-top: 20px;
  border-radius: 8px;
}

.print-button {
  margin-top: 20px;
  padding: 10px 18px;
  border: 0;
  background: #2b1e1c;
  color: white;
  border-radius: 5px;
  cursor: pointer;
}

@media print {

  body {
    background: white;
    padding: 0;
  }

  .receipt {
    border: none;
    max-width: none;
  }

  .print-button {
    display: none;
  }

}

</style>

</head>


<body>

<div class="receipt">

  <div class="brand">
    Gloriya Jewellery
  </div>

  <div class="muted">
    Jaipur, Rajasthan
  </div>

  <hr>


  <h2>
    ${
      shopCopy
        ? "Shop Order Receipt"
        : "Order Receipt"
    }
  </h2>


  <div class="info-box">

    <p>
      <strong>Order ID:</strong>
      ${orderId}
    </p>

    <p>
      <strong>Date:</strong>
      ${orderDate}
    </p>

    <p>
      <strong>Status:</strong>
      ${status}
    </p>

  </div>


  <div class="info-box">

    <p>
      <strong>Customer:</strong>
      ${customerName}
    </p>

    <p>
      <strong>Email:</strong>
      ${customerEmail}
    </p>

    <p>
      <strong>Phone:</strong>
      ${phone}
    </p>

    <p>
      <strong>Address:</strong>
      ${address},
      ${city}
      -
      ${pincode}
    </p>

  </div>


  <table>

    <thead>

      <tr>

        <th>
          Product
        </th>

        <th>
          Qty
        </th>

        <th>
          Price
        </th>

        <th>
          Total
        </th>

      </tr>

    </thead>


    <tbody>

      ${rows}

    </tbody>

  </table>


  <p
    class="total"
    style="text-align:right;"
  >

    Grand Total:
    ₹${total}

  </p>


  <div class="info-box">
    <strong>Delivery:</strong>
    Your order will be delivered within 7-8 working days after successful payment.
  </div>

  <p class="muted">
    Thank you for shopping
    with Gloriya Jewellery.
  </p>


  <div style="display:flex;justify-content:center;flex-wrap:wrap;margin-top:18px">
    <a class="print-button" href="${downloadUrl}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block">
      Receipt — Print / Download
    </a>
  </div>


</div>

</body>

</html>
`;
}



export function buildReceiptAccessToken(order){
  const secret = env.SESSION_SECRET || env.RAZORPAY_KEY_SECRET;
  if(!secret) return "";
  const orderId = String(order?.order_id || order?.id || "");
  const paymentId = String(order?.payment_id || "");
  const amount = String(order?.amount || "");
  return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}|${amount}`).digest("hex");
}

/* =========================================================
   DOWNLOADABLE PDF RECEIPT
   ========================================================= */
function pdfEscape(value=""){
  return String(value)
    .replace(/\\/g,"\\\\")
    .replace(/\(/g,"\\(")
    .replace(/\)/g,"\\)")
    .replace(/\r?\n/g," ");
}

export function buildReceiptPdf(order){
  const orderId = order?.order_id || order?.id || "N/A";
  const date = order?.timestamp || new Date().toLocaleString("en-IN");
  const name = order?.name || "";
  const email = order?.user_email || order?.email || "";
  const phone = order?.phone || "";
  const address = [order?.address, order?.city, order?.pincode].filter(Boolean).join(", ");
  const total = Number(order?.amount || 0).toFixed(2);

  const lines = [
    "GLORIYA JEWELLERY",
    "ORDER RECEIPT",
    "",
    `Order ID: ${orderId}`,
    `Date: ${date}`,
    `Status: ${order?.status || "completed"}`,
    "",
    `Customer: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Address: ${address}`,
    "",
    "ITEMS",
    "----------------------------------------",
    ...(Array.isArray(order?.items) && order.items.length
      ? order.items.map((it) => {
          const qty = Number(it?.qty || it?.quantity || 1);
          const price = Number(it?.unit_price ?? it?.price ?? 0);
          const line = Number(it?.line_total ?? price * qty);
          return `${String(it?.name || "Product").slice(0,42)}  x${qty}  Rs.${line.toFixed(2)}`;
        })
      : ["No items"]),
    "----------------------------------------",
    `GRAND TOTAL: Rs.${total}`,
    "",
    "Payment successful.",
    "Your order will be delivered within 7-8 working days.",
    "Thank you for shopping with Gloriya Jewellery.",
  ];

  const safeLines = lines.map((line) => pdfEscape(line).slice(0, 105));
  const streamLines = [
    "BT",
    "/F1 11 Tf",
    "50 780 Td",
    ...safeLines.map((line, i) => `${i ? "0 -17 Td\n" : ""}(${line}) Tj`),
    "ET"
  ].join("\n");

  const objects = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>");
  objects.push(`<< /Length ${Buffer.byteLength(streamLines, "utf8")} >>\nstream\n${streamLines}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for(let i=0;i<objects.length;i++){
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${i+1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++) pdf += `${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function receiptAttachment(order){
  const orderId = order?.order_id || order?.id || "order";
  return {
    filename: `Gloriya-Order-Receipt-${String(orderId).replace(/[^a-zA-Z0-9_-]/g,"_")}.pdf`,
    content: buildReceiptPdf(order).toString("base64"),
    content_type: "application/pdf"
  };
}

export async function sendShippingStatusEmail(order, status){
  const recipient = order?.user_email || order?.email;
  if(!recipient) return { ok:false, error:"no_recipient" };

  const orderId = order?.order_id || order?.id || "N/A";
  const name = order?.name || "Customer";
  const messages = {
    packed: {
      subject: `Your Gloriya order #${orderId} is packed`,
      title: "Your order is packed 📦",
      body: `Your order #${orderId} has been packed and is ready for shipment.`
    },
    shipped: {
      subject: `Your Gloriya order #${orderId} has shipped`,
      title: "Your order has been shipped 🚚",
      body: `Your order #${orderId} has been shipped and is on its way to you.`
    },
    out_for_delivery: {
      subject: `Your Gloriya order #${orderId} is out for delivery`,
      title: "Your order is out for delivery 🛍️",
      body: `Your order #${orderId} is out for delivery. You can expect delivery within 1-2 days.`
    },
    delivered: {
      subject: `Your Gloriya order #${orderId} has been delivered`,
      title: "Your order has been delivered ✨",
      body: `Your order #${orderId} has been delivered. Thank you for shopping with Gloriya Jewellery.`
    }
  };
  const copy = messages[status];
  if(!copy) return { ok:true, skipped:true };

  return sendEmail(copy.subject, recipient, {
    htmlBody:`<div style="font-family:Arial,sans-serif;color:#2b1e1c;max-width:640px;margin:auto;padding:30px">
      <h2 style="font-family:Georgia,serif;margin:0 0 16px">Gloriya Jewellery</h2>
      <p>Hi ${String(name).replace(/[&<>"']/g,"")},</p>
      <h3>${copy.title}</h3>
      <p>${copy.body}</p>
      <div style="background:#faf5f2;padding:16px;border-radius:8px;margin:20px 0">
        <strong>Order ID:</strong> ${String(orderId).replace(/[&<>"']/g,"")}
      </div>
      <p>Thank you for shopping with Gloriya Jewellery.</p>
    </div>`,
    textBody:`Hi ${name},\n\n${copy.body}\n\nOrder ID: ${orderId}\n\nThank you for shopping with Gloriya Jewellery.`
  });
}

/* =========================================================
   SEND ORDER EMAIL
   CUSTOMER + SHOP
   ========================================================= */

export async function sendOrderEmail(
  order,
  user
) {
  const customer =
    user?.email ||
    order?.user_email ||
    order?.email;

  const shop =
    env.MAIL_SHOP_RECIPIENT;


  const orderId =
    order?.order_id ||
    order?.id ||
    "N/A";


  const amount =
    Number(order?.amount || 0)
      .toFixed(2);


  const receiptToken = buildReceiptAccessToken(order);
  const downloadUrl = receiptToken ? receiptDownloadUrl(order) : "";

  const text = `
Gloriya Jewellery Order Receipt

Order ID: ${orderId}

Customer:
${order?.name || ""}

Email:
${order?.user_email || order?.email || ""}

Phone:
${order?.phone || ""}

Total:
₹${amount}

Payment Status:
Successful

Delivery:
Your order will be delivered within 7-8 working days after successful payment.

Thank you for shopping with Gloriya Jewellery.

${downloadUrl ? `Download your receipt: ${downloadUrl}` : ""}
`;


  const results = [];


  /* =====================================================
     CUSTOMER RECEIPT
     ===================================================== */

  if (customer) {

    console.log("\n📦 CUSTOMER ORDER RECEIPT");

    const customerResult =
      await sendEmail(
        `Order Receipt — #${orderId}`,
        customer,
        {
          htmlBody:
            `${buildReceiptHtml(order)}
            ${downloadUrl ? `<div style="max-width:760px;margin:18px auto;font-family:Arial,sans-serif;text-align:center"><a href="${downloadUrl}" style="display:inline-block;padding:12px 20px;background:#2b1e1c;color:#fff;text-decoration:none;border-radius:7px">Download Receipt PDF</a></div>` : ""}`,

          textBody:
            text,
          attachments: [receiptAttachment(order)],
        }
      );

    results.push({
      type: "customer",
      recipient: customer,
      ...customerResult,
    });
  }


  /* =====================================================
     SHOP RECEIPT
     ===================================================== */

  if (
    shop &&
    shop.toLowerCase() !==
      String(customer || "").toLowerCase()
  ) {

    console.log("\n🏪 SHOP ORDER RECEIPT");

    const shopResult =
      await sendEmail(
        `New Shop Order — #${orderId}`,
        shop,
        {
          htmlBody:
            buildReceiptHtml(
              order,
              {
                shopCopy: true,
              }
            ),

          textBody:
            text,
          attachments: [receiptAttachment(order)],
        }
      );

    results.push({
      type: "shop",
      recipient: shop,
      ...shopResult,
    });
  }


  /* =====================================================
     FINAL ORDER EMAIL RESULT
     ===================================================== */

  const finalResult = {
    ok: results.some(
      (result) => result.ok
    ),

    results,
  };


  if (finalResult.ok) {
    console.log("\n========================================");
    console.log("🎉 ORDER EMAIL PROCESS COMPLETED");
    console.log("========================================");
    console.log(
      "Successful emails:",
      results.filter((result) => result.ok).length
    );
    console.log(
      "Failed emails:",
      results.filter((result) => !result.ok).length
    );
    console.log("========================================\n");
  } else {
    console.error("\n========================================");
    console.error("❌ ORDER EMAIL PROCESS FAILED");
    console.error("========================================");
    console.error("No email was sent successfully.");
    console.error("========================================\n");
  }


  return finalResult;
}
export async function sendPasswordResetEmail(user, resetUrl) {
  const recipient = user?.email;
  if (!recipient) return { ok: false, error: "no_recipient" };
  const name = String(user?.name || "there");
  return sendEmail("Reset your Gloriya Jewellery password", recipient, {
    htmlBody: `
      <div style="font-family:Arial,sans-serif;color:#2b1e1c;max-width:620px;margin:auto;padding:24px">
        <h2 style="font-family:Georgia,serif">Gloriya Jewellery</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your account password.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#b8860b;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a></p>
        <p style="color:#777">This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>
      </div>`,
    textBody: `Hi ${name}, reset your Gloriya Jewellery password here: ${resetUrl}`
  });
}
