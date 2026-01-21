"use client"

import React, { useEffect, useRef, useState } from 'react';

interface AnimatedShaderBackgroundProps {
  children?: React.ReactNode;
  className?: string;
}

const AnimatedShaderBackground = ({ children, className }: AnimatedShaderBackgroundProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(true); // Default to mobile for SSR
  const [isVisible, setIsVisible] = useState(false);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Intersection Observer to only animate when visible
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isMobile) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [isMobile]);

  // WebGL animation only on desktop
  useEffect(() => {
    if (isMobile) return;
    
    const container = containerRef.current;
    if (!container) return;

    // Dynamically import THREE.js only on desktop
    import('three').then((THREE) => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
      
      const material = new THREE.ShaderMaterial({
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) }
        },
        vertexShader: `
          void main() {
            gl_Position = vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float iTime;
          uniform vec2 iResolution;

          #define NUM_OCTAVES 2

          float rand(vec2 n) {
            return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
          }

          float noise(vec2 p) {
            vec2 ip = floor(p);
            vec2 u = fract(p);
            u = u*u*(3.0-2.0*u);

            float res = mix(
              mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
              mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
            return res * res;
          }

          float fbm(vec2 x) {
            float v = 0.0;
            float a = 0.3;
            vec2 shift = vec2(100);
            mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
            for (int i = 0; i < NUM_OCTAVES; ++i) {
              v += a * noise(x);
              x = rot * x * 2.0 + shift;
              a *= 0.4;
            }
            return v;
          }

          void main() {
            vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
            vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
            vec2 v;
            vec4 o = vec4(0.0);

            float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;

            for (float i = 0.0; i < 20.0; i++) {
              v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
              float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 20.0));
              vec4 auroraColors = vec4(
                0.1 + 0.3 * sin(i * 0.2 + iTime * 0.4),
                0.3 + 0.5 * cos(i * 0.3 + iTime * 0.5),
                0.7 + 0.3 * sin(i * 0.4 + iTime * 0.3),
                1.0
              );
              vec4 currentContribution = auroraColors * exp(sin(i * i + iTime * 0.8)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
              float thinnessFactor = smoothstep(0.0, 1.0, i / 20.0) * 0.6;
              o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
            }

            o = tanh(pow(o / 100.0, vec4(1.6)));
            gl_FragColor = o * 1.8;
          }
        `
      });

      const updateSize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        const shaderWidth = Math.max(width, 800);
        const shaderHeight = height * (shaderWidth / width);
        material.uniforms.iResolution.value.set(shaderWidth, shaderHeight);
      };

      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.left = '0';
      renderer.domElement.style.zIndex = '0';
      container.appendChild(renderer.domElement);

      const geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      updateSize();

      let frameId: number;
      let lastTime = 0;
      const targetFPS = 30;
      const frameInterval = 1000 / targetFPS;

      const animate = (currentTime: number) => {
        frameId = requestAnimationFrame(animate);
        
        const deltaTime = currentTime - lastTime;
        if (deltaTime < frameInterval) return;
        
        lastTime = currentTime - (deltaTime % frameInterval);
        material.uniforms.iTime.value += 0.02;
        renderer.render(scene, camera);
      };
      
      requestAnimationFrame(animate);

      const handleResize = () => updateSize();
      window.addEventListener('resize', handleResize);

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', handleResize);
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    });
  }, [isMobile, isVisible]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-neutral-950 ${className || ''}`}>
      {/* Static gradient background for mobile */}
      {isMobile && (
        <div 
          className="absolute inset-0 z-0 opacity-60"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 50%, rgba(6, 182, 212, 0.15) 100%)'
          }}
        />
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default AnimatedShaderBackground;
