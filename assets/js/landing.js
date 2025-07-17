// Landing page JavaScript for enhanced interactivity

document.addEventListener('DOMContentLoaded', function() {
    // tsParticles configuration for VLSI theme
    tsParticles.load("tsparticles", {
        fpsLimit: 60,
        particles: {
            number: {
                value: 80,
                density: {
                    enable: true,
                    value_area: 800
                }
            },
            color: {
                value: "#2a3352"
            },
            shape: {
                type: "square",
            },
            opacity: {
                value: 0.5,
                random: true,
            },
            size: {
                value: 3,
                random: true,
            },
            links: {
                enable: true,
                distance: 150,
                color: "#38bdf8",
                opacity: 0.2,
                width: 1
            },
            move: {
                enable: true,
                speed: 1,
                direction: "none",
                out_mode: "out",
                bounce: false,
                attract: {
                    enable: false,
                    rotateX: 600,
                    rotateY: 1200
                }
            }
        },
        interactivity: {
            detect_on: "window", // Changed from "canvas"
            events: {
                onhover: {
                    enable: true,
                    mode: "grab"
                },
                onclick: {
                    enable: true,
                    mode: "push"
                },
                resize: true
            },
            modes: {
                grab: {
                    distance: 140,
                    line_linked: {
                        opacity: 0.5
                    }
                },
                push: {
                    particles_nb: 4
                },
            }
        },
        retina_detect: true,
        background: {
            color: "transparent"
        }
    });

    // Sticky navigation effect
    const nav = document.querySelector('.top-nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('sticky');
        } else {
            nav.classList.remove('sticky');
        }
    });

    // Intersection Observer for fade-in animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const elementsToAnimate = document.querySelectorAll('.content-section, .tool-card, .step-card, .author-content, .benefit-card');
    elementsToAnimate.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        observer.observe(el);
    });

    // GSAP Scroll-triggered animation for the circuit
    gsap.registerPlugin(ScrollTrigger);

    gsap.to(".animated-circuit-path", {
        strokeDashoffset: 0,
        scrollTrigger: {
            trigger: ".tool-card",
            start: "top 80%", // When the top of the card is 80% from the top of the viewport
            end: "bottom 60%", // When the bottom of the card is 60% from the top of the viewport
            scrub: true, // Smoothly scrubs the animation as you scroll
            markers: false // Set to true for debugging
        }
    });

    // Enhanced circuit animation
    const animatedPath = document.querySelector('.animated-path');
    const bumps = document.querySelectorAll('.bump');
    
    if (animatedPath) {
        // Add random sparkle effects along the path
        setInterval(() => {
            createSparkle();
        }, 2000);
    }

    function createSparkle() {
        const svg = document.querySelector('.animated-circuit');
        if (!svg) return;
        
        const sparkle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const pathLength = 400; // Approximate path length
        const randomPosition = Math.random() * pathLength;
        
        // Calculate position along path (simplified)
        const x = 50 + (randomPosition / pathLength) * 200;
        const y = 100 + Math.sin(randomPosition / 50) * 25;
        
        sparkle.setAttribute('cx', x);
        sparkle.setAttribute('cy', y);
        sparkle.setAttribute('r', '2');
        sparkle.setAttribute('fill', '#fbbf24');
        sparkle.setAttribute('opacity', '0');
        
        svg.appendChild(sparkle);
        
        // Animate sparkle
        sparkle.animate([
            { opacity: 0, transform: 'scale(0)' },
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0)' }
        ], {
            duration: 1000,
            easing: 'ease-out'
        }).onfinish = () => {
            sparkle.remove();
        };
    }

    // Parallax effect for hero section
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const heroVisual = document.querySelector('.hero-visual');
        if (heroVisual) {
            heroVisual.style.transform = `translateY(${scrolled * 0.1}px)`;
        }
    });

    // Dynamic grid background animation
    const gridBg = document.querySelector('.grid-bg');
    if (gridBg) {
        let mouseX = 0;
        let mouseY = 0;
        
        document.addEventListener('mousemove', function(e) {
            mouseX = (e.clientX / window.innerWidth) * 100;
            mouseY = (e.clientY / window.innerHeight) * 100;
            
            gridBg.style.backgroundPosition = `${mouseX * 0.1}px ${mouseY * 0.1}px`;
        });
    }

    // Button hover effects
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Feature card interactive effects
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px) rotateX(5deg)';
            this.style.transition = 'all 0.3s ease';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) rotateX(0deg)';
        });
    });

    // Tool card hover effects
    const toolCards = document.querySelectorAll('.tool-card');
    toolCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            const icon = this.querySelector('.tool-icon');
            if (icon) {
                icon.style.transform = 'scale(1.1) rotate(5deg)';
                icon.style.transition = 'all 0.3s ease';
            }
        });
        
        card.addEventListener('mouseleave', function() {
            const icon = this.querySelector('.tool-icon');
            if (icon) {
                icon.style.transform = 'scale(1) rotate(0deg)';
            }
        });
    });

    // Loading animation for external links
    const externalLinks = document.querySelectorAll('a[href^="http"]');
    externalLinks.forEach(link => {
        link.addEventListener('click', function() {
            this.style.opacity = '0.7';
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.opacity = '1';
                this.style.transform = 'scale(1)';
            }, 150);
        });
    });
});
