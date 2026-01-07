document.addEventListener('DOMContentLoaded', () => {
    // --- 0. DARK MODE TOGGLE ---
    const themeBtn = document.getElementById('theme-toggle');
    const body = document.body;

    // A. Check LocalStorage on Load
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        body.classList.add('dark-mode');
    }

    // B. Handle Button Click (Switch Theme)
    themeBtn.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });

    // --- 2. ELASTIC CURSOR LOGIC ---
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');

    if (window.matchMedia("(pointer: fine)").matches) {
        
        let mouseX = 0, mouseY = 0;
        let outlineX = 0, outlineY = 0;

        let isCursorVisible = false;

        const speed = 0.15;
        const squeeze = 0.15;

        window.addEventListener('mousemove', (e) => {
            // 1. Get position
            mouseX = e.clientX;
            mouseY = e.clientY;
            
            // 2. logic for First Move
            if (!isCursorVisible) {
                isCursorVisible = true;
                
                // Snap outline to mouse instantly so it doesn't "fly" from 0,0
                outlineX = mouseX;
                outlineY = mouseY;
                
                // Show the cursor
                document.body.classList.add('cursor-active');
            }

            // 3. Move the dot immediately
            cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
        });

        const animate = () => {
            // ... keep your existing animate code exactly the same ...
            const distX = mouseX - outlineX;
            const distY = mouseY - outlineY;

            outlineX += distX * speed;
            outlineY += distY * speed;

            const angle = Math.atan2(distY, distX);
            const vel = Math.sqrt(distX ** 2 + distY ** 2);
            
            const stretch = Math.min(vel * squeeze * 0.01, 0.5);
            const scaleX = 1 + stretch;
            const scaleY = 1 - stretch;

            cursorOutline.style.transform = `
                translate(${outlineX}px, ${outlineY}px) 
                rotate(${angle}rad) 
                scale(${scaleX}, ${scaleY})
            `;

            requestAnimationFrame(animate);
        };

        animate();

        // 3. Hover States
        document.querySelectorAll('a, button, .nav-link').forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
        });
    }
});
