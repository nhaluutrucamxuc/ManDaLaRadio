import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js';

class EtherealEnvironment {
  constructor(container) {
    this.container = container;
    this.dayCycle = 0.0;
    this.targetDayCycle = 0.0;
    this.isRaining = false;
    
    console.log('🎨 Init...');
    
    this.init();
    this.createSky();
    this.createStars();
    this.createClouds();
    this.createRainSystem();
    this.createRainSplashSystem();
    this.createMeteorSystem();
    this.animate();
    this.setupResize();
    
    console.log('✅ Ready');
  }

  init() {
    this.scene = new THREE.Scene();
    
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    
    this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    this.camera.position.z = 5;
    
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);
    
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);
    
    this.clock = new THREE.Clock();
  }

  createSky() {
    const skyGeometry = new THREE.SphereGeometry(100, 64, 64);
    
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        dayCycle: { value: this.dayCycle },
        time: { value: 0 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float dayCycle;
        uniform float time;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        
        vec3 mixColors(vec3 a, vec3 b, float t) {
          return mix(a, b, smoothstep(0.0, 1.0, t));
        }
        
        float stars(vec2 uv, float density) {
          vec2 pos = fract(uv * density);
          float d = length(pos - 0.5);
          return smoothstep(0.02, 0.0, d) * (0.5 + 0.5 * sin(time * 2.0 + uv.x * 100.0));
        }
        
        float noise(vec2 uv) {
          return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        float cloudPattern(vec2 uv) {
          float n = 0.0;
          float amplitude = 1.0;
          float frequency = 1.0;
          for(int i = 0; i < 4; i++) {
            n += noise(uv * frequency + time * 0.05) * amplitude;
            amplitude *= 0.5;
            frequency *= 2.0;
          }
          return n;
        }
        
        void main() {
          float elevation = vWorldPosition.y / 100.0;
          vec2 cloudUv = vUv * 3.0;
          
          vec3 midnightTop = vec3(0.02, 0.02, 0.1);
          vec3 midnightBottom = vec3(0.0, 0.0, 0.02);
          vec3 sunriseTop = vec3(0.4, 0.6, 0.9);
          vec3 sunriseBottom = vec3(1.0, 0.7, 0.4);
          vec3 noonTop = vec3(0.3, 0.6, 1.0);
          vec3 noonBottom = vec3(0.7, 0.85, 1.0);
          vec3 sunsetTop = vec3(0.2, 0.1, 0.3);
          vec3 sunsetBottom = vec3(1.0, 0.4, 0.2);
          
          vec3 topColor, bottomColor;
          
          if (dayCycle < 0.125) {
            float t = dayCycle / 0.125;
            topColor = mixColors(midnightTop, midnightTop * 1.2, t);
            bottomColor = mixColors(midnightBottom, midnightBottom * 1.5, t);
          } else if (dayCycle < 0.375) {
            float t = (dayCycle - 0.125) / 0.25;
            topColor = mixColors(midnightTop * 1.2, sunriseTop, t);
            bottomColor = mixColors(midnightBottom * 1.5, sunriseBottom, t);
          } else if (dayCycle < 0.625) {
            float t = (dayCycle - 0.375) / 0.25;
            topColor = mixColors(sunriseTop, noonTop, t);
            bottomColor = mixColors(sunriseBottom, noonBottom, t);
          } else if (dayCycle < 0.875) {
            float t = (dayCycle - 0.625) / 0.25;
            topColor = mixColors(noonTop, sunsetTop, t);
            bottomColor = mixColors(noonBottom, sunsetBottom, t);
          } else {
            float t = (dayCycle - 0.875) / 0.125;
            topColor = mixColors(sunsetTop, midnightTop, t);
            bottomColor = mixColors(sunsetBottom, midnightBottom, t);
          }
          
          vec3 skyColor = mix(bottomColor, topColor, smoothstep(-0.5, 0.8, elevation));
          
          float nightIntensity = 0.0;
          if (dayCycle < 0.125 || dayCycle > 0.875) {
            nightIntensity = dayCycle < 0.125 ? (1.0 - dayCycle / 0.125) : ((dayCycle - 0.875) / 0.125);
          }
          
          if (nightIntensity > 0.0) {
            float starField = stars(vUv * 2.0, 50.0) + stars(vUv * 2.0 + vec2(0.5), 80.0) * 0.7;
            float milkyWay = smoothstep(0.3, 0.7, cloudPattern(vUv * 0.5)) * 0.15;
            skyColor += (starField + milkyWay) * nightIntensity * vec3(0.8, 0.9, 1.0);
          }
          
          float dayIntensity = 1.0 - nightIntensity;
          if (dayIntensity > 0.3) {
            float clouds = smoothstep(0.4, 0.7, cloudPattern(cloudUv));
            skyColor = mix(skyColor, skyColor * 1.15, clouds * dayIntensity * 0.3);
          }
          
          skyColor += vec3(0.05, 0.05, 0.08) * (1.0 - abs(elevation)) * 0.5;
          
          gl_FragColor = vec4(skyColor, 1.0);
        }
      `,
      side: THREE.BackSide
    });
    
    this.skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(this.skyMesh);
    this.skyMaterial = skyMaterial;
  }

  createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1000;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    
    for (let i = 0; i < starCount * 3; i += 3) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 50 + Math.random() * 30;
      
      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);
      sizes[i / 3] = Math.random() * 2 + 1;
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        nightIntensity: { value: 1.0 },
        time: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        uniform float nightIntensity;
        uniform float time;
        varying float vOpacity;
        
        void main() {
          vOpacity = nightIntensity * (0.5 + 0.5 * sin(time + position.x * 0.1));
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z) * nightIntensity;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          float alpha = smoothstep(0.5, 0.0, dist) * vOpacity;
          gl_FragColor = vec4(0.9, 0.95, 1.0, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    this.stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.stars);
    this.starMaterial = starMaterial;
  }

  createClouds() {
    this.cloudParticles = [];
    for (let i = 0; i < 15; i++) {
      const cloudGeometry = new THREE.SphereGeometry(2 + Math.random() * 3, 16, 16);
      const cloudMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        fog: false
      });
      
      const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
      cloud.position.set(
        (Math.random() - 0.5) * 40,
        10 + Math.random() * 10,
        -20 - Math.random() * 20
      );
      cloud.userData.speed = 0.001 + Math.random() * 0.002;
      cloud.userData.opacity = 0.1 + Math.random() * 0.15;
      
      this.cloudParticles.push(cloud);
      this.scene.add(cloud);
    }
  }

  createRainSystem() {
    // MƯA LÃNG MẠN - CHỈ 600 GIỌT (giảm từ 1500)
    const rainCount = 300;
    const rainGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount);
    
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / h;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * 5;
    const width = height * aspect;
    
    for (let i = 0; i < rainCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * width * 2.0;
      positions[i + 1] = Math.random() * height * 2.0 - height / 2;
      positions[i + 2] = (Math.random() - 0.5) * 10;
      velocities[i / 3] = 0.15 + Math.random() * 0.08; // Chậm hơn
    }
    
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    rainGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));
    
    const rainMaterial = new THREE.LineBasicMaterial({
      color: 0x88aaff,
      transparent: true,
      opacity: 0,
      linewidth: 1
    });
    
    this.rainLines = [];
    for (let i = 0; i < rainCount; i++) {
      const lineGeometry = new THREE.BufferGeometry();
      const linePositions = new Float32Array(6);
      lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      
      const line = new THREE.Line(lineGeometry, rainMaterial.clone());
      line.userData.velocity = velocities[i];
      line.userData.x = positions[i * 3];
      line.userData.y = positions[i * 3 + 1];
      line.userData.z = positions[i * 3 + 2];
      
      this.rainLines.push(line);
      this.scene.add(line);
    }
    
    this.rainBounds = { width, height };
    console.log(`🌧️ Mưa lãng mạn: ${rainCount} giọt`);
  }

  createRainSplashSystem() {
    const splashCount = 400; // Giảm từ 1000
    const splashGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(splashCount * 3);
    const velocities = new Float32Array(splashCount * 3);
    const lifetimes = new Float32Array(splashCount);
    const sizes = new Float32Array(splashCount);
    
    for (let i = 0; i < splashCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -100;
      positions[i * 3 + 2] = 0;
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
      lifetimes[i] = 1.0;
      sizes[i] = 1.5 + Math.random() * 1.5; // Nhỏ hơn
    }
    
    splashGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    splashGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    splashGeometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    splashGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const splashMaterial = new THREE.ShaderMaterial({
      uniforms: {
        opacity: { value: 0.0 }
      },
      vertexShader: `
        attribute vec3 velocity;
        attribute float lifetime;
        attribute float size;
        varying float vLifetime;
        
        void main() {
          vLifetime = lifetime;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (1.0 - lifetime) * 4.0;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float opacity;
        varying float vLifetime;
        
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          float alpha = smoothstep(0.5, 0.0, dist) * opacity * (1.0 - vLifetime) * 0.8;
          gl_FragColor = vec4(0.6, 0.8, 1.0, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    this.rainSplash = new THREE.Points(splashGeometry, splashMaterial);
    this.scene.add(this.rainSplash);
    this.splashMaterial = splashMaterial;
    this.splashPositions = positions;
    this.splashVelocities = velocities;
    this.splashLifetimes = lifetimes;
    this.splashSizes = sizes;
    this.splashIndex = 0;
  }

  createMeteorSystem() {
    this.activeMeteors = [];
  }

  triggerMeteor() {
    const meteorGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(60);
    
    for (let i = 0; i < 60; i += 3) {
      positions[i] = 0;
      positions[i + 1] = 0;
      positions[i + 2] = 0;
    }
    
    meteorGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const meteorMaterial = new THREE.LineBasicMaterial({
      color: 0xffeeaa,
      transparent: true,
      opacity: 1.0,
      linewidth: 3
    });
    
    const meteor = new THREE.Line(meteorGeometry, meteorMaterial);
    
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / h;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * 5;
    const width = height * aspect;
    
    const startX = (width / 2) * 0.85;
    const startY = (height / 2) * 0.85;
    const startZ = -2 - Math.random() * 2;
    
    meteor.position.set(startX, startY, startZ);
    
    const angle = -35 - Math.random() * 20;
    const angleRad = (angle * Math.PI) / 180;
    const speed = 0.4 + Math.random() * 0.2;
    
    meteor.userData.velocity = new THREE.Vector3(
      Math.cos(angleRad) * speed * -1,
      Math.sin(angleRad) * speed,
      0.02 + Math.random() * 0.05
    );
    
    meteor.userData.life = 2.5;
    meteor.userData.positions = positions;
    meteor.userData.currentIndex = 0;
    
    this.activeMeteors.push(meteor);
    this.scene.add(meteor);
  }

  triggerSplash(x, y, z) {
    // Splash MẠNH HƠN để dễ thấy
    const splashCount = 12 + Math.floor(Math.random() * 8); // 12-20 hạt
    
    for (let i = 0; i < splashCount; i++) {
      const index = this.splashIndex;
      this.splashIndex = (this.splashIndex + 1) % this.splashLifetimes.length;
      
      const idx = index * 3;
      
      this.splashPositions[idx] = x + (Math.random() - 0.5) * 0.2;
      this.splashPositions[idx + 1] = y + 0.05; // Cao hơn
      this.splashPositions[idx + 2] = z + (Math.random() - 0.5) * 0.2;
      
      const angle = (Math.PI * 2 * i) / splashCount + (Math.random() - 0.5) * 0.3;
      const spreadSpeed = 0.08 + Math.random() * 0.08; // NHANH HƠN
      this.splashVelocities[idx] = Math.cos(angle) * spreadSpeed;
      this.splashVelocities[idx + 1] = 0.1 + Math.random() * 0.08; // BAY CAO HƠN
      this.splashVelocities[idx + 2] = Math.sin(angle) * spreadSpeed;
      
      this.splashLifetimes[index] = 0;
      this.splashSizes[index] = 3.0 + Math.random() * 4.0; // TO HƠN
    }
  }

  updateEnvironment(dayCycle, isRaining, triggerMeteor) {
    this.targetDayCycle = Math.max(0, Math.min(1, dayCycle));
    this.isRaining = isRaining;
    
    if (triggerMeteor) {
      this.triggerMeteor();
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();
    
    // Smooth transition
    if (this.targetDayCycle !== undefined) {
      let diff = this.targetDayCycle - this.dayCycle;
      
      if (Math.abs(diff) > 0.5) {
        if (diff > 0) {
          diff -= 1.0;
        } else {
          diff += 1.0;
        }
      }
      
      this.dayCycle += diff * 0.008;
      
      if (this.dayCycle > 1.0) this.dayCycle -= 1.0;
      if (this.dayCycle < 0.0) this.dayCycle += 1.0;
    }
    
    // Update sky
    if (this.skyMaterial) {
      this.skyMaterial.uniforms.dayCycle.value = this.dayCycle;
      this.skyMaterial.uniforms.time.value = elapsed;
    }
    
    // Update stars
    if (this.starMaterial) {
      let nightIntensity = 0.0;
      if (this.dayCycle < 0.125 || this.dayCycle > 0.875) {
        nightIntensity = this.dayCycle < 0.125 ? (1.0 - this.dayCycle / 0.125) : ((this.dayCycle - 0.875) / 0.125);
      }
      this.starMaterial.uniforms.nightIntensity.value = nightIntensity;
      this.starMaterial.uniforms.time.value = elapsed;
    }
    
    if (this.stars) {
      this.stars.rotation.y += 0.0001;
    }
    
    // Update clouds
    const dayIntensity = this.dayCycle > 0.2 && this.dayCycle < 0.8 ? 1.0 : 0.0;
    this.cloudParticles.forEach(cloud => {
      cloud.position.x += cloud.userData.speed;
      if (cloud.position.x > 25) cloud.position.x = -25;
      
      const targetOpacity = dayIntensity * cloud.userData.opacity;
      cloud.material.opacity += (targetOpacity - cloud.material.opacity) * 0.02;
    });
    
    // Update rain - MƯA NHẸ
    if (this.rainLines) {
      const targetOpacity = this.isRaining ? 0.35 : 0.0; // Giảm từ 0.5 xuống 0.35
      const bottomY = -this.rainBounds.height / 4;
      
      this.rainLines.forEach(line => {
        line.material.opacity += (targetOpacity - line.material.opacity) * 0.08;
        
        if (line.material.opacity > 0.01) {
          line.userData.y -= line.userData.velocity;
          
          const lineLength = line.userData.velocity * 3.0;
          const positions = line.geometry.attributes.position.array;
          positions[0] = line.userData.x;
          positions[1] = line.userData.y;
          positions[2] = line.userData.z;
          positions[3] = line.userData.x;
          positions[4] = line.userData.y + lineLength;
          positions[5] = line.userData.z;
          line.geometry.attributes.position.needsUpdate = true;
          
          // CHẠM ĐÁY ĐÚNG VỊ TRÍ
          if (line.userData.y <= bottomY) {
            this.triggerSplash(line.userData.x, bottomY, line.userData.z);
            
            line.userData.y = this.rainBounds.height / 2 + Math.random() * 8;
            line.userData.x = (Math.random() - 0.5) * this.rainBounds.width * 2.0;
            line.userData.z = (Math.random() - 0.5) * 10;
          }
        }
      });
    }
    
    // Update splash - ĐÚNG ĐÁY
    if (this.rainSplash && this.splashMaterial) {
      this.splashMaterial.uniforms.opacity.value = this.isRaining ? 0.8 : 0.0;
      
      const bottomY = -this.rainBounds.height / 4;
      
      for (let i = 0; i < this.splashLifetimes.length; i++) {
        if (this.splashLifetimes[i] < 1.0) {
          const idx = i * 3;
          this.splashPositions[idx] += this.splashVelocities[idx];
          this.splashPositions[idx + 1] += this.splashVelocities[idx + 1];
          this.splashPositions[idx + 2] += this.splashVelocities[idx + 2];
          
          // Gravity
          this.splashVelocities[idx + 1] -= 0.003;
          
          // Không cho rơi quá đáy
          if (this.splashPositions[idx + 1] < bottomY) {
            this.splashPositions[idx + 1] = bottomY;
            this.splashVelocities[idx + 1] = 0;
          }
          
          // Friction
          this.splashVelocities[idx] *= 0.96;
          this.splashVelocities[idx + 2] *= 0.96;
          
          this.splashLifetimes[i] += delta * 3.5;
        }
      }
      
      this.rainSplash.geometry.attributes.position.needsUpdate = true;
      this.rainSplash.geometry.attributes.lifetime.needsUpdate = true;
      this.rainSplash.geometry.attributes.size.needsUpdate = true;
    }
    
    // Update meteors
    for (let i = this.activeMeteors.length - 1; i >= 0; i--) {
      const meteor = this.activeMeteors[i];
      meteor.userData.life -= delta * 0.5;
      
      if (meteor.userData.life <= 0) {
        this.scene.remove(meteor);
        this.activeMeteors.splice(i, 1);
        continue;
      }
      
      meteor.position.add(meteor.userData.velocity);
      
      const positions = meteor.userData.positions;
      const index = meteor.userData.currentIndex;
      
      positions[index * 3] = 0;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = 0;
      
      for (let j = 1; j < 20; j++) {
        const prevIndex = (index - j + 20) % 20;
        positions[prevIndex * 3] = -meteor.userData.velocity.x * j * 2.5;
        positions[prevIndex * 3 + 1] = -meteor.userData.velocity.y * j * 2.5;
        positions[prevIndex * 3 + 2] = -meteor.userData.velocity.z * j * 2.5;
      }
      
      meteor.userData.currentIndex = (index + 1) % 20;
      meteor.geometry.attributes.position.needsUpdate = true;
      meteor.material.opacity = meteor.userData.life / 2.5;
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  setupResize() {
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        
        if (w > 0 && h > 0) {
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(w, h);
          
          const aspect = w / h;
          const vFov = (this.camera.fov * Math.PI) / 180;
          const height = 2 * Math.tan(vFov / 2) * 5;
          const width = height * aspect;
          this.rainBounds = { width, height };
        }
      }
    });
    
    resizeObserver.observe(this.container);
  }
}

let environment = null;

window.initThreeEnvironment = function(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Container not found');
    return;
  }
  
  environment = new EtherealEnvironment(container);
  console.log('✅ Mưa lãng mạn ready');
};

window.updateEnvironment = function(dayCycle, isRaining, triggerMeteor) {
  if (environment) {
    environment.updateEnvironment(dayCycle, isRaining, triggerMeteor);
  }
};