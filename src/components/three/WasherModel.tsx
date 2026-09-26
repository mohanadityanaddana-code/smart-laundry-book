import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Float,
  RoundedBox,
  Sparkles,
} from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";

function usePrefersReducedMotion() {
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  );
  return reduced;
}

function useWebGLAvailable() {
  const [available] = useState(() => {
    try {
      const canvas = document.createElement("canvas");
      return !!(
        canvas.getContext("webgl2") || canvas.getContext("webgl")
      );
    } catch {
      return false;
    }
  });
  return available;
}

function WasherMesh() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group = useRef<any>(null);
  const drum = useRef<any>(null);
  const reduced = usePrefersReducedMotion();

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f2f6f7",
        roughness: 0.3,
        metalness: 0.25,
      }),
    [],
  );
  const panelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#dde8ea",
        roughness: 0.45,
        metalness: 0.2,
      }),
    [],
  );
  const drumMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#37444b",
        roughness: 0.35,
        metalness: 0.8,
      }),
    [],
  );
  const drumInner = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#9fb6bd",
        roughness: 0.5,
        metalness: 0.6,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const accentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0d9488",
        roughness: 0.3,
        metalness: 0.4,
        emissive: new THREE.Color("#0d9488"),
        emissiveIntensity: 0.25,
      }),
    [],
  );
  const dialMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#223036",
        roughness: 0.25,
        metalness: 0.6,
      }),
    [],
  );

  // Slow, continuous premium rotation; frozen when reduced motion is on.
  useFrame((state, delta) => {
    if (group.current && !reduced) {
      group.current.rotation.y += delta * 0.35;
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.04;
    }
    if (drum.current && !reduced) {
      drum.current.rotation.z += delta * 0.8;
    }
  });

  return (
    <group ref={group} position={[0, 0.1, 0]}>
      {/* Main cabinet */}
      <RoundedBox args={[1.7, 2.15, 1.35]} radius={0.16} smoothness={6} material={bodyMat} castShadow />
      {/* Control panel */}
      <RoundedBox
        args={[1.7, 0.5, 0.06]}
        radius={0.08}
        smoothness={5}
        position={[0, 0.78, 0.69]}
        material={panelMat}
      />
      {/* Dial */}
      <mesh position={[-0.42, 0.78, 0.74]} material={dialMat}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 32]} />
      </mesh>
      <mesh position={[-0.42, 0.78, 0.79]} rotation={[Math.PI / 2, 0, 0]} material={accentMat}>
        <torusGeometry args={[0.16, 0.02, 12, 40]} />
      </mesh>
      {/* Indicator lights */}
      <mesh position={[0.3, 0.85, 0.73]} material={accentMat}>
        <sphereGeometry args={[0.035, 16, 16]} />
      </mesh>
      <mesh position={[0.45, 0.85, 0.73]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshStandardMaterial color="#a7c8cd" roughness={0.4} />
      </mesh>
      {/* Brand strip */}
      <mesh position={[0.02, 0.62, 0.72]} material={accentMat}>
        <boxGeometry args={[0.5, 0.05, 0.02]} />
      </mesh>
      {/* Porthole outer ring */}
      <mesh position={[0, -0.22, 0.71]} rotation={[Math.PI / 2, 0, 0]} material={drumMat}>
        <torusGeometry args={[0.56, 0.09, 20, 60]} />
      </mesh>
      {/* Porthole glass ring (accent) */}
      <mesh position={[0, -0.22, 0.72]} rotation={[Math.PI / 2, 0, 0]} material={accentMat}>
        <torusGeometry args={[0.63, 0.018, 12, 60]} />
      </mesh>
      {/* Drum (slowly spins) */}
      <group ref={drum} position={[0, -0.22, 0.62]}>
        <mesh material={drumInner}>
          <cylinderGeometry args={[0.5, 0.5, 0.22, 40, 1, true]} />
        </mesh>
        <mesh material={drumMat}>
          <boxGeometry args={[0.62, 0.1, 0.02]} />
        </mesh>
        <mesh position={[0.18, 0.16, 0]} material={drumMat}>
          <boxGeometry args={[0.3, 0.06, 0.02]} />
        </mesh>
      </group>
      {/* Porthole glass */}
      <mesh position={[0, -0.22, 0.66]}>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 40]} />
        <meshPhysicalMaterial
          color="#bfe9ee"
          transparent
          opacity={0.32}
          roughness={0.08}
          metalness={0.1}
        />
      </mesh>
      {/* Feet */}
      {[
        [-0.6, -1.13, 0.45],
        [0.6, -1.13, 0.45],
        [-0.6, -1.13, -0.45],
        [0.6, -1.13, -0.45],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} material={dialMat}>
          <cylinderGeometry args={[0.09, 0.11, 0.14, 16]} />
        </mesh>
      ))}
    </group>
  );
}

function Scene() {
  const reduced = usePrefersReducedMotion();
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} castShadow />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#9fd8dd" />
      <Suspense fallback={null}>
        <Float
          speed={reduced ? 0 : 1.4}
          rotationIntensity={reduced ? 0 : 0.12}
          floatIntensity={reduced ? 0 : 0.5}
        >
          <WasherMesh />
        </Float>
        {!reduced && <Sparkles count={26} scale={5} size={2.2} speed={0.35} color="#67e8f9" opacity={0.5} />}
        <Environment preset="city" />
        <ContactShadows position={[0, -1.45, 0]} opacity={0.35} scale={7} blur={2.6} far={3} />
      </Suspense>
    </>
  );
}

/** Full-bleed 3D hero visual with graceful non-WebGL fallback. */
export function WasherHero3D({ className }: { className?: string }) {
  const webgl = useWebGLAvailable();

  if (!webgl) {
    // Clean fallback: layered rings suggesting a washer porthole.
    return (
      <div className={className} aria-hidden>
        <div className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-border/60 bg-gradient-to-br from-secondary to-card" />
          <div className="absolute inset-[12%] rounded-full border-4 border-primary/30 bg-gradient-to-br from-card to-secondary" />
          <div className="absolute inset-[26%] rounded-full bg-gradient-to-br from-primary/15 to-accent/10 backdrop-blur-sm" />
          <WashingMachinePlaceholderIcon />
        </div>
      </div>
    );
  }

  return (
    <div className={className} aria-hidden>
      <Canvas
        camera={{ position: [0, 0.2, 5.2], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}

function WashingMachinePlaceholderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-24 text-primary/70" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
      <path d="M4 7.5h16" />
      <circle cx="8" cy="5" r="0.4" fill="currentColor" />
      <circle cx="10.5" cy="5" r="0.4" fill="currentColor" />
      <circle cx="12" cy="14" r="4.5" />
      <path d="M9.5 13c1 .8 2 .8 2.5.3s1.5-.6 2.5.3" />
    </svg>
  );
}
