"use client";

import React, { useRef, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { RippleButton } from "@/components/ui/multi-type-ripple-buttons";

const ShaderCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glProgramRef = useRef<WebGLProgram | null>(null);
  const glBgColorLocationRef = useRef<WebGLUniformLocation | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const [backgroundColor, setBackgroundColor] = useState([0.96, 0.94, 0.91]);

  useEffect(() => {
    const root = document.documentElement;
    const updateColor = () => {
      const isDark = root.classList.contains("dark");
      setBackgroundColor(isDark ? [0.08, 0.08, 0.08] : [0.96, 0.94, 0.91]);
    };
    updateColor();
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          updateColor();
        }
      }
    });
    observer.observe(root, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const gl = glRef.current;
    const program = glProgramRef.current;
    const location = glBgColorLocationRef.current;
    if (gl && program && location) {
      gl.useProgram(program);
      gl.uniform3fv(location, new Float32Array(backgroundColor));
    }
  }, [backgroundColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const gl = canvas.getContext("webgl");
    if (!gl) {
      return;
    }
    glRef.current = gl;

    const vertexShaderSource = `attribute vec2 aPosition; void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;
    const fragmentShaderSource = `
      precision highp float;
      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec3 uBackgroundColor;
      mat2 rotate2d(float angle){ float c=cos(angle),s=sin(angle); return mat2(c,-s,s,c); }
      float variation(vec2 v1,vec2 v2,float strength,float speed){ return sin(dot(normalize(v1),normalize(v2))*strength+iTime*speed)/100.0; }
      vec3 paintCircle(vec2 uv,vec2 center,float rad,float width){
        vec2 diff = center-uv;
        float len = length(diff);
        len += variation(diff,vec2(0.,1.),5.,2.);
        len -= variation(diff,vec2(1.,0.),5.,2.);
        float circle = smoothstep(rad-width,rad,len)-smoothstep(rad,rad+width,len);
        return vec3(circle);
      }
      void main(){
        vec2 uv = gl_FragCoord.xy/iResolution.xy;
        uv.x *= 1.5; uv.x -= 0.25;
        float mask = 0.0;
        float radius = .35;
        vec2 center = vec2(.5);
        mask += paintCircle(uv,center,radius,.035).r;
        mask += paintCircle(uv,center,radius-.018,.01).r;
        mask += paintCircle(uv,center,radius+.018,.005).r;
        vec2 v=rotate2d(iTime)*uv;
        vec3 foregroundColor=vec3(v.x,v.y,.7-v.y*v.x);
        vec3 color=mix(uBackgroundColor,foregroundColor,mask);
        color=mix(color,vec3(1.),paintCircle(uv,center,radius,.003).r);
        gl_FragColor=vec4(color,1.);
      }`;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) {
        throw new Error("Could not create shader");
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation error");
      }
      return shader;
    };

    const program = gl.createProgram();
    if (!program) {
      throw new Error("Could not create program");
    }
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);
    glProgramRef.current = program;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const iTimeLoc = gl.getUniformLocation(program, "iTime");
    const iResLoc = gl.getUniformLocation(program, "iResolution");
    glBgColorLocationRef.current = gl.getUniformLocation(program, "uBackgroundColor");
    gl.uniform3fv(glBgColorLocationRef.current, new Float32Array(backgroundColor));

    let animationFrameId: number;
    const render = (time: number) => {
      gl.uniform1f(iTimeLoc, time * 0.001);
      gl.uniform2f(iResLoc, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [backgroundColor]);

  return <canvas ref={canvasRef} className="fixed left-0 top-0 z-0 block h-full w-full bg-background" />;
};

export interface PricingCardProps {
  planName: string;
  description: string;
  price: string;
  features: string[];
  buttonText: string;
  isPopular?: boolean;
  buttonVariant?: "primary" | "secondary";
  href?: string;
}

export const PricingCard = ({
  planName,
  description,
  price,
  features,
  buttonText,
  isPopular = false,
  buttonVariant = "primary",
  href
}: PricingCardProps) => {
  const cardClasses = `
    rounded-[28px] shadow-xl flex-1 w-full max-w-sm px-7 py-8 flex flex-col transition-all duration-300
    bg-[rgba(255,252,248,0.92)] border border-[rgba(215,180,158,0.55)]
    ${isPopular ? "relative ring-2 ring-[rgba(49,83,74,0.18)] border-[rgba(49,83,74,0.32)] shadow-2xl -translate-y-1" : ""}
  `;
  const buttonClasses = `
    mt-auto w-full py-3 rounded-[18px] font-semibold text-[14px] transition font-sans
    ${
      buttonVariant === "primary"
        ? "bg-[rgb(var(--brand-accent))] hover:bg-[#8f4334] text-white"
        : "bg-[rgba(255,252,248,0.96)] hover:bg-[rgba(166,79,60,0.08)] text-foreground border border-[rgba(215,180,158,0.7)]"
    }
  `;

  const handleClick = () => {
    if (href) {
      window.location.href = href;
    }
  };

  return (
    <div className={cardClasses.trim()}>
      {isPopular ? (
        <div className="absolute right-5 top-5 rounded-full bg-[rgb(var(--brand-secondary))] px-3 py-1 text-[12px] font-semibold text-white">
          Mas elegido
        </div>
      ) : null}
      <div className="mb-3">
        <h2 className="font-display text-[42px] leading-none tracking-[-0.03em] text-foreground md:text-[48px]">
          {planName}
        </h2>
        <p className="mt-2 font-sans text-[15px] text-foreground/70">{description}</p>
      </div>
      <div className="my-6 flex items-baseline gap-2">
        <span className="font-display text-[44px] font-light text-foreground md:text-[50px]">€{price}</span>
        <span className="font-sans text-[14px] text-foreground/70">/mes</span>
      </div>
      <div className="mb-5 h-px w-full bg-[rgba(215,180,158,0.55)]" />
      <ul className="mb-6 flex flex-col gap-2 text-[14px] text-foreground/90">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-[rgb(var(--brand-secondary))]" strokeWidth={2.5} />
            {feature}
          </li>
        ))}
      </ul>
      <RippleButton className={buttonClasses.trim()} onClick={handleClick}>
        {buttonText}
      </RippleButton>
    </div>
  );
};

interface ModernPricingPageProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  plans: PricingCardProps[];
  showAnimatedBackground?: boolean;
}

export const ModernPricingPage = ({
  title,
  subtitle,
  plans,
  showAnimatedBackground = true
}: ModernPricingPageProps) => {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      {showAnimatedBackground ? <ShaderCanvas /> : null}
      <main className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-8">
        <div className="mx-auto mb-14 w-full max-w-5xl text-center">
          <h1 className="font-display text-[48px] leading-tight tracking-[-0.03em] text-foreground md:text-[64px]">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl font-sans text-[16px] text-foreground/80 md:text-[20px]">{subtitle}</p>
        </div>
        <div className="flex w-full max-w-5xl flex-col items-stretch justify-center gap-8 md:flex-row md:gap-6">
          {plans.map((plan) => (
            <PricingCard key={plan.planName} {...plan} />
          ))}
        </div>
      </main>
    </div>
  );
};
