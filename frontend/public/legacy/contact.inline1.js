
      // Copy address
      document.addEventListener('click', (e)=>{
        if(e.target.id === 'copyAddr'){
          const text = '114, Arjun Nagar, Durgapura, Jaipur';
          navigator.clipboard?.writeText(text).then(()=>{
            if (window.notify) window.notify('Address copied', 'success', '📋');
            else alert('Address copied');
          });
        }
      });

      // Contact form -> real backend email
      document.getElementById('contactForm').addEventListener('submit', async (e)=>{
        e.preventDefault();
        const form=e.currentTarget;
        const name=document.getElementById('name');
        const email=document.getElementById('email');
        const msg=document.getElementById('message');

        const cleanName = (name?.value || '').trim();
        const cleanEmail = (email?.value || '').trim();
        const cleanMessage = (msg?.value || '').trim();

        if (name) name.value = cleanName;
        if (email) email.value = cleanEmail;
        if (msg) msg.value = cleanMessage;

        let ok=true;
        [name,email,msg].forEach(i=>{
          if(!i) return;
          const isValidEmail = i.type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((i.value || '').trim()) : true;
          if(!i.value.trim() || (i.type==='email' && !isValidEmail)){
            i.classList.add('is-invalid');
            i.setCustomValidity('Please enter a valid email.');
            ok=false;
          } else {
            i.classList.remove('is-invalid');
            i.setCustomValidity('');
          }
        });
        if(!ok) return;
        const button=form.querySelector('button[type="submit"]');
        if(button){button.disabled=true; button.dataset.oldText=button.innerHTML; button.innerHTML='Sending…';}
        try{
          const res=await fetch(`${window.API_BASE || "https://gloriya.in/api"}/contact`,{
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({name:name.value.trim(),email:email.value.trim(),message:msg.value.trim()})
          });
          const data=await res.json().catch(()=>({}));
          if(!res.ok) throw new Error(data.msg || data.error || 'Unable to send message');
          if(window.notify) window.notify('Your message has been sent successfully.', 'success', '✉️');
          else alert('Your message has been sent successfully.');
          form.reset();
        }catch(err){
          console.error('Contact submit failed',err);
          if(window.notify) window.notify('Unable to send your message. Please try again.', 'error', '⚠️');
          else alert('Unable to send your message. Please try again.');
        }finally{
          if(button){button.disabled=false; button.innerHTML=button.dataset.oldText || 'Send';}
        }
      });
