document.addEventListener("DOMContentLoaded", async () => {
    const navContainer = document.createElement('nav');
    navContainer.style.backgroundColor = '#fff';
    navContainer.style.padding = '1rem';
    navContainer.style.borderRadius = '0.5rem';
    navContainer.style.marginBottom = '1rem';
    navContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
    
    const mainElement = document.querySelector('main.card');
    if (mainElement) {
        document.body.insertBefore(navContainer, mainElement);
    } else {
        document.body.prepend(navContainer);
    }

    try {
        const res = await fetch('/api/session');
        const data = await res.json();

        let navLinks = '';
        if (data.loggedIn) {
            navLinks += `<a href="/index.html" style="margin-right: 1rem;">Soru Çöz</a>`;
            navLinks += `<a href="/library.html" style="margin-right: 1rem;">Kütüphane</a>`;
            if (data.user.role === 'admin') {
                navLinks += `<a href="/admin.html" style="margin-right: 1rem;">Admin Paneli</a>`;
            }
            navLinks += `<a href="#" id="logoutBtn" style="float: right;">Çıkış Yap</a>`;
        } else {
            navLinks = `
                <a href="/login.html" style="margin-right: 1rem;">Giriş Yap</a>
                <a href="/register.html" style="margin-right: 1rem;">Kayıt Ol</a>
            `;
        }
        navContainer.innerHTML = navLinks;

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/login.html';
            });
        }

    } catch (error) {
        console.error("Oturum bilgisi alınamadı:", error);
        navContainer.innerHTML = `<a href="/login.html">Giriş Yap</a> | <a href="/register.html">Kayıt Ol</a>`;
    }
});
