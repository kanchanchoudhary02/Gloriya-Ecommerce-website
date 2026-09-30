import express from "express";
import { env } from "../config/env.js";
import { sendEmail } from "../services/mail.js";
import Subscriber from "../models/Subscriber.js";

const router=express.Router();

function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

router.post("/", async (req,res)=>{
  const {name,email,message}=req.body||{};
  const cleanEmail = String(email ?? "").trim();
  if(!name?.trim() || !cleanEmail || !message?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)){
    return res.status(400).json({msg:"Name, valid email and message are required"});
  }
  if(!env.MAIL_CONTACT_RECIPIENT) return res.status(503).json({msg:"Contact email is not configured on the server"});
  const result=await sendEmail(`New Gloriya Contact — ${name.trim()}`,env.MAIL_CONTACT_RECIPIENT,{
    htmlBody:`<h3>New contact enquiry</h3><p><strong>Name:</strong> ${esc(name)}</p><p><strong>Email:</strong> ${esc(cleanEmail)}</p><p><strong>Message:</strong><br>${esc(message).replace(/\n/g,"<br>")}</p>`,
    textBody:`New contact enquiry\nName: ${name}\nEmail: ${cleanEmail}\n\n${message}`,
    replyTo: cleanEmail.toLowerCase()
  });
  if(!result.ok) return res.status(502).json({msg:"Email could not be sent",error:result.error});
  res.json({ok:true,msg:"Message sent successfully"});
});
export default router;

router.post("/subscribe", async (req,res)=>{
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    return res.status(400).json({ok:false,msg:"Please enter a valid email address."});
  }
  try{
    const existing = await Subscriber.findOne({ email }).lean();
    if(!existing){
      await Subscriber.create({ email });
    }
    // Best-effort confirmation; subscription itself remains successful if email delivery is unavailable.
    try{
      await sendEmail("Welcome to Gloriya Jewellery", email, {
        htmlBody:`<div style="font-family:Arial,sans-serif;color:#2b1e1c;max-width:620px;margin:auto;padding:28px">
          <h2 style="margin:0 0 12px">Gloriya Jewellery</h2>
          <p>Thank you for subscribing to our exclusive community.</p>
          <p>You’ll receive special offers and updates on our new collections.</p>
          <p style="color:#777">✨ No spam, only luxury updates.</p>
        </div>`,
        textBody:"Thank you for subscribing to Gloriya Jewellery. You’ll receive special offers and updates on our new collections."
      });
    }catch{}
    return res.json({ok:true,msg: existing ? "Thank you — you are already subscribed." : "Thank you for subscribing to Gloriya Jewellery!"});
  }catch(error){
    if(error?.code === 11000) return res.json({ok:true,msg:"Thank you — you are already subscribed."});
    console.error("Newsletter subscribe error:", error);
    return res.status(500).json({ok:false,msg:"Subscription could not be completed. Please try again."});
  }
});
