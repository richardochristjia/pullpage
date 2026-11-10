"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import styles from "./catalog.module.css";

const RUNNER_MODELS = [
  {
    id: "025",
    name: "Pikachu",
    src: "/models/025.glb",
    cameraOrbit: "-60deg 75deg 5.1m",
    cameraTarget: "0m 0.18m 0m",
    fieldOfView: "35deg",
    translateY: "24px",
  },
  {
    id: "133",
    name: "Eevee",
    src: "/models/133.glb",
    cameraOrbit: "-60deg 75deg 3.0m",
    cameraTarget: "0m 0.17m 0m",
    fieldOfView: "35deg",
    translateY: "24px",
  },
  {
    id: "004",
    name: "Charmander",
    src: "/models/004.glb",
    cameraOrbit: "-60deg 75deg 5.8m",
    cameraTarget: "-0.06m 0.24m 0m",
    fieldOfView: "35deg",
    translateY: "27px",
  },
  {
    id: "007",
    name: "Squirtle",
    src: "/models/007.glb",
    cameraOrbit: "-60deg 75deg 4.3m",
    cameraTarget: "0m 0.22m 0m",
    fieldOfView: "35deg",
    translateY: "10px",
  },
  {
    id: "001",
    name: "Bulbasaur",
    src: "/models/001.glb",
    cameraOrbit: "-60deg 75deg 2.9m",
    cameraTarget: "0m 0.20m 0m",
    fieldOfView: "35deg",
    translateY: "30px",
  },
] as const;

type RunnerModelElement = HTMLElement & { play(): void; pause(): void };

export function PokemonRunner() {
  const runnerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<RunnerModelElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [onScreen, setOnScreen] = useState(true);
  const model = RUNNER_MODELS[activeIndex];

  useEffect(() => {
    const el = runnerRef.current;
    if (!el) return;

    const onIteration = () => {
      setActiveIndex((prev) => (prev + 1) % RUNNER_MODELS.length);
    };

    el.addEventListener("animationiteration", onIteration);
    return () => el.removeEventListener("animationiteration", onIteration);
  }, []);

  // Warm the next model early in the lap so the swap is served from cache. The delay keeps it
  // off the page-load path, where only the current model should be requested.
  useEffect(() => {
    const next = RUNNER_MODELS[(activeIndex + 1) % RUNNER_MODELS.length].src;
    const timer = setTimeout(() => void fetch(next, { priority: "low" }).catch(() => {}), 4000);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = modelRef.current;
    // play/pause exist only once the lazy-loaded script has upgraded the element.
    if (typeof el?.play === "function") void (onScreen ? el.play() : el.pause());
  }, [onScreen]);

  return (
    <>
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
        strategy="lazyOnload"
      />
      <div ref={wrapperRef} className={`${styles.runnerTrackWrapper} ${onScreen ? "" : styles.runnerPaused}`}>
        <div
          ref={runnerRef}
          className={styles.filterbar3dRunner}
          title="⚡ 3D Pokémon companions running across the shelf"
          aria-hidden="true"
        >
          <div className={styles.runnerStage}>
            <model-viewer
              ref={modelRef}
              id="runner-model"
              class={styles.runnerModel}
              src={model.src}
              alt={`${model.name} Running`}
              animation-name="run"
              autoplay
              camera-orbit={model.cameraOrbit}
              camera-target={model.cameraTarget}
              field-of-view={model.fieldOfView}
              disable-zoom
              disable-pan
              interaction-prompt="none"
              shadow-intensity="0"
              exposure="0.98"
              style={{ transform: `translateY(${model.translateY})` }}
            />
            <div className={styles.runnerContactShadow} />
          </div>
        </div>
      </div>
    </>
  );
}
