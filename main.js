    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
    });

        // Intersection Observer for fade-in animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.fade-in-up').forEach(el => {
            observer.observe(el);
        });

        // Form submission handler
        document.getElementById('contact-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            // Here you would typically send the form data to a server
            alert('Thank you for your message! I\'ll get back to you soon.');
            e.target.reset();
        });

        // Active nav link highlighting with Lenis
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('.nav-link');

        lenis.on('scroll', ({ scroll }) => {
            let current = '';
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.clientHeight;
                if (scroll >= sectionTop - 200) {
                    current = section.getAttribute('id');
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('text-white');
                link.classList.add('text-slate-300');
                if (link.getAttribute('href') === `#${current}`) {
                    link.classList.remove('text-slate-300');
                    link.classList.add('text-white');
                }
            });
        });

        // TouchTexture class - tracks mouse movements with trails
        class TouchTexture {
            constructor(size = 64) {
                this.size = size;
                this.width = this.height = size;
                this.maxAge = 64;
                this.radius = 0.25 * size;
                this.speed = 1 / this.maxAge;
                this.trail = [];
                this.last = null;
                this.initTexture();
            }

            initTexture() {
                this.canvas = document.createElement('canvas');
                this.canvas.width = this.width;
                this.canvas.height = this.height;
                this.ctx = this.canvas.getContext('2d');
                this.ctx.fillStyle = 'black';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }

            update() {
                this.clear();
                const speed = this.speed;
                
                for (let i = this.trail.length - 1; i >= 0; i--) {
                    const point = this.trail[i];
                    const f = point.force * speed * (1 - point.age / this.maxAge);
                    point.x += point.vx * f;
                    point.y += point.vy * f;
                    point.age++;
                    
                    if (point.age > this.maxAge) {
                        this.trail.splice(i, 1);
                    } else {
                        this.drawPoint(point);
                    }
                }
            }

            clear() {
                this.ctx.fillStyle = 'black';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }

            addTouch(point) {
                let force = 0;
                let vx = 0;
                let vy = 0;
                const last = this.last;
                
                if (last) {
                    const dx = point.x - last.x;
                    const dy = point.y - last.y;
                    if (dx === 0 && dy === 0) return;
                    const dd = dx * dx + dy * dy;
                    const d = Math.sqrt(dd);
                    vx = dx / d;
                    vy = dy / d;
                    force = Math.min(dd * 20000, 2.0);
                }
                
                this.last = { x: point.x, y: point.y };
                this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
            }

            drawPoint(point) {
                const pos = {
                    x: point.x * this.width,
                    y: (1 - point.y) * this.height
                };

                let intensity = 1;
                if (point.age < this.maxAge * 0.3) {
                    intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
                } else {
                    const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
                    intensity = -t * (t - 2);
                }
                intensity *= point.force;

                const radius = this.radius;
                const color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255}, ${intensity * 255}`;
                const offset = this.size * 5;
                
                this.ctx.shadowOffsetX = offset;
                this.ctx.shadowOffsetY = offset;
                this.ctx.shadowBlur = radius * 1;
                this.ctx.shadowColor = `rgba(${color}, ${0.2 * intensity})`;

                this.ctx.beginPath();
                this.ctx.fillStyle = 'rgba(255,0,0,1)';
                this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // WebGL Liquid Background Effect with Shaders
        (function() {
            const canvas = document.getElementById('liquid-canvas');
            if (!canvas) return;

            // Make the canvas non-interactive so UI elements remain clickable
            try {
                canvas.style.pointerEvents = 'none';
                // Ensure canvas is behind UI (use a low z-index)
                canvas.style.zIndex = '0';
            } catch (e) {
                // ignore if styling fails
            }

            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) {
                console.warn('WebGL not supported');
                return;
            }

            // Touch texture system
            const touchTextureInstance = new TouchTexture(64);

            // Vertex shader source
            const vertexShaderSource = `
                attribute vec2 a_position;
                attribute vec2 a_texCoord;
                varying vec2 v_texCoord;
                void main() {
                    gl_Position = vec4(a_position, 0.0, 1.0);
                    v_texCoord = a_texCoord;
                }
            `;

            // Fragment shader source - creates liquid blob effect with water distortion
            const fragmentShaderSource = `
                precision mediump float;
                uniform vec2 u_resolution;
                uniform float u_time;
                uniform vec3 u_color1;
                uniform vec3 u_color2;
                uniform sampler2D u_touchTexture;
                uniform float u_speed;
                uniform float u_intensity;
                
                varying vec2 v_texCoord;
                
                #define PI 3.14159265359
                
                // Grain function for film grain effect
                float grain(vec2 uv, float time) {
                    vec2 grainUv = uv * u_resolution * 0.5;
                    return fract(sin(dot(grainUv + time, vec2(12.9898, 78.233))) * 43758.5453) * 2.0 - 1.0;
                }
                
                vec3 getGradientColor(vec2 uv, float time) {
                    float gradientRadius = 0.45;
                    
                    // Multiple animated centers with different speeds
                    vec2 center1 = vec2(
                        0.5 + sin(time * u_speed * 0.4) * 0.4,
                        0.5 + cos(time * u_speed * 0.5) * 0.4
                    );
                    vec2 center2 = vec2(
                        0.5 + cos(time * u_speed * 0.6) * 0.5,
                        0.5 + sin(time * u_speed * 0.45) * 0.5
                    );
                    vec2 center3 = vec2(
                        0.5 + sin(time * u_speed * 0.35) * 0.45,
                        0.5 + cos(time * u_speed * 0.55) * 0.45
                    );
                    vec2 center4 = vec2(
                        0.5 + cos(time * u_speed * 0.5) * 0.4,
                        0.5 + sin(time * u_speed * 0.4) * 0.4
                    );
                    vec2 center5 = vec2(
                        0.5 + sin(time * u_speed * 0.7) * 0.35,
                        0.5 + cos(time * u_speed * 0.6) * 0.35
                    );
                    vec2 center6 = vec2(
                        0.5 + cos(time * u_speed * 0.45) * 0.5,
                        0.5 + sin(time * u_speed * 0.65) * 0.5
                    );
                    
                    float dist1 = length(uv - center1);
                    float dist2 = length(uv - center2);
                    float dist3 = length(uv - center3);
                    float dist4 = length(uv - center4);
                    float dist5 = length(uv - center5);
                    float dist6 = length(uv - center6);
                    
                    float influence1 = 1.0 - smoothstep(0.0, gradientRadius, dist1);
                    float influence2 = 1.0 - smoothstep(0.0, gradientRadius, dist2);
                    float influence3 = 1.0 - smoothstep(0.0, gradientRadius, dist3);
                    float influence4 = 1.0 - smoothstep(0.0, gradientRadius, dist4);
                    float influence5 = 1.0 - smoothstep(0.0, gradientRadius, dist5);
                    float influence6 = 1.0 - smoothstep(0.0, gradientRadius, dist6);
                    
                    // Rotation layers for depth
                    vec2 rotatedUv1 = uv - 0.5;
                    float angle1 = time * u_speed * 0.15;
                    rotatedUv1 = vec2(
                        rotatedUv1.x * cos(angle1) - rotatedUv1.y * sin(angle1),
                        rotatedUv1.x * sin(angle1) + rotatedUv1.y * cos(angle1)
                    );
                    rotatedUv1 += 0.5;
                    
                    vec2 rotatedUv2 = uv - 0.5;
                    float angle2 = -time * u_speed * 0.12;
                    rotatedUv2 = vec2(
                        rotatedUv2.x * cos(angle2) - rotatedUv2.y * sin(angle2),
                        rotatedUv2.x * sin(angle2) + rotatedUv2.y * cos(angle2)
                    );
                    rotatedUv2 += 0.5;
                    
                    float radialGradient1 = length(rotatedUv1 - 0.5);
                    float radialGradient2 = length(rotatedUv2 - 0.5);
                    float radialInfluence1 = 1.0 - smoothstep(0.0, 0.8, radialGradient1);
                    float radialInfluence2 = 1.0 - smoothstep(0.0, 0.8, radialGradient2);
                    
                    // Blend all colors
                    vec3 color = vec3(0.0);
                    color += u_color1 * influence1 * (0.55 + 0.45 * sin(time * u_speed));
                    color += u_color2 * influence2 * (0.55 + 0.45 * cos(time * u_speed * 1.2));
                    color += u_color1 * influence3 * (0.55 + 0.45 * sin(time * u_speed * 0.8));
                    color += u_color2 * influence4 * (0.55 + 0.45 * cos(time * u_speed * 1.3));
                    color += u_color1 * influence5 * (0.55 + 0.45 * sin(time * u_speed * 1.1));
                    color += u_color2 * influence6 * (0.55 + 0.45 * cos(time * u_speed * 0.9));
                    
                    color += mix(u_color1, u_color2, radialInfluence1) * 0.45;
                    color += mix(u_color2, u_color1, radialInfluence2) * 0.4;
                    
                    color = clamp(color, vec3(0.0), vec3(1.0)) * u_intensity;
                    
                    // Enhanced saturation
                    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
                    color = mix(vec3(luminance), color, 1.35);
                    color = pow(color, vec3(0.92));
                    
                    return color;
                }
                
                void main() {
                    vec2 uv = v_texCoord;
                    
                    // Apply water distortion from touch texture
                    vec4 touchTex = texture2D(u_touchTexture, uv);
                    float vx = -(touchTex.r * 2.0 - 1.0);
                    float vy = -(touchTex.g * 2.0 - 1.0);
                    float intensity = touchTex.b;
                    
                    // Strong distortion for liquid effect
                    uv.x += vx * 0.8 * intensity;
                    uv.y += vy * 0.8 * intensity;
                    
                    // Combined ripple and wave effect
                    vec2 center = vec2(0.5);
                    float dist = length(uv - center);
                    float ripple = sin(dist * 20.0 - u_time * 3.0) * 0.04 * intensity;
                    float wave = sin(dist * 15.0 - u_time * 2.0) * 0.03 * intensity;
                    uv += vec2(ripple + wave);
                    
                    vec3 color = getGradientColor(uv, u_time);
                    
                    // Apply grain effect
                    float grainValue = grain(uv, u_time);
                    color += grainValue * 0.08;
                    
                    // Subtle color shifting
                    float timeShift = u_time * 0.5;
                    color.r += sin(timeShift) * 0.02;
                    color.g += cos(timeShift * 1.4) * 0.02;
                    color.b += sin(timeShift * 1.2) * 0.02;
                    
                    color = clamp(color, vec3(0.0), vec3(1.0));
                    
                    // Apply alpha for hazy effect - increased for better visibility
                    // Canvas will blend with dark background naturally
                    gl_FragColor = vec4(color, 0.5);
                }
            `;

            // Compile shader
            function compileShader(source, type) {
                const shader = gl.createShader(type);
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
                    gl.deleteShader(shader);
                    return null;
                }
                
                return shader;
            }

            // Create shader program
            const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
            const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
            
            if (!vertexShader || !fragmentShader) return;

            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error('Program linking error:', gl.getProgramInfoLog(program));
                return;
            }

            gl.useProgram(program);

            // Create full-screen quad with texture coordinates
            const positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                -1, -1,  0, 0,
                 1, -1,  1, 0,
                -1,  1,  0, 1,
                -1,  1,  0, 1,
                 1, -1,  1, 0,
                 1,  1,  1, 1
            ]), gl.STATIC_DRAW);

            const positionLocation = gl.getAttribLocation(program, 'a_position');
            const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
            
            gl.enableVertexAttribArray(positionLocation);
            gl.enableVertexAttribArray(texCoordLocation);
            
            const stride = 4 * 4; // 4 floats per vertex (x, y, u, v)
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, stride, 8);

            // Create touch texture
            const touchTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, touchTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            // Get uniform locations
            const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
            const timeLocation = gl.getUniformLocation(program, 'u_time');
            const color1Location = gl.getUniformLocation(program, 'u_color1');
            const color2Location = gl.getUniformLocation(program, 'u_color2');
            const touchTextureLocation = gl.getUniformLocation(program, 'u_touchTexture');
            const speedLocation = gl.getUniformLocation(program, 'u_speed');
            const intensityLocation = gl.getUniformLocation(program, 'u_intensity');

            // Colors from theme (RGB normalized 0-1)
            const color1 = [0.0, 0.831, 1.0]; // #00d4ff (primary)
            const color2 = [0.486, 0.227, 0.929]; // #7c3aed (secondary)

            let time = 0;
            let mouse = { x: 0.5, y: 0.5 };

            // Initialize canvas size
            function resizeCanvas() {
                const dpr = window.devicePixelRatio || 1;
                const width = window.innerWidth;
                const height = window.innerHeight;
                
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                
                gl.viewport(0, 0, canvas.width, canvas.height);
            }

            // Update touch texture
            function updateTouchTexture() {
                touchTextureInstance.update();
                gl.bindTexture(gl.TEXTURE_2D, touchTexture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, touchTextureInstance.canvas);
            }

            // Mouse move handler
            function handleMouseMove(e) {
                mouse = {
                    x: e.clientX / window.innerWidth,
                    y: 1 - e.clientY / window.innerHeight
                };
                touchTextureInstance.addTouch(mouse);
            }

            // Touch move handler for mobile
            function handleTouchMove(e) {
                if (e.touches.length > 0) {
                    const touch = e.touches[0];
                    mouse = {
                        x: touch.clientX / window.innerWidth,
                        y: 1 - touch.clientY / window.innerHeight
                    };
                    touchTextureInstance.addTouch(mouse);
                }
            }

            // Render function
            function render() {
                time += 0.016; // ~60fps

                // Update touch texture
                updateTouchTexture();

                // Set uniforms
                gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
                gl.uniform1f(timeLocation, time);
                gl.uniform3fv(color1Location, color1);
                gl.uniform3fv(color2Location, color2);
                gl.uniform1f(speedLocation, 1.5);
                gl.uniform1f(intensityLocation, 1.8);

                // Bind touch texture
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, touchTexture);
                gl.uniform1i(touchTextureLocation, 0);

                // Enable blending for transparency
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                // Clear and draw
                gl.clearColor(0.0, 0.0, 0.0, 0.0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.drawArrays(gl.TRIANGLES, 0, 6);

                requestAnimationFrame(render);
            }

            // Initialize
            resizeCanvas();
            render();

            // Event listeners
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('touchmove', handleTouchMove, { passive: true });

            // Throttled resize handler
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    resizeCanvas();
                }, 100);
            });
        })();

        


        