"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import styles from "./catalog.module.css";

const RUNNER_MODELS = [
  {
    id: "025",
    name: "Pikachu",
    src: "https://raw.githubusercontent.com/06wj/pokemon/master/public/models/025/model.glb",
    cameraOrbit: "-60deg 75deg 5.1m",
    cameraTarget: "0m 0.18m 0m",
    fieldOfView: "35deg",
    translateY: "24px",
  },
  {
    id: "133",
    name: "Eevee",
    src: "https://raw.githubusercontent.com/06wj/pokemon/master/public/models/133/model.glb",
    cameraOrbit: "-60deg 75deg 3.0m",
    cameraTarget: "0m 0.17m 0m",
    fieldOfView: "35deg",
    translateY: "24px",
  },
  {
    id: "004",
    name: "Charmander",
    src: "https://raw.githubusercontent.com/06wj/pokemon/master/public/models/004/model.glb",
    cameraOrbit: "-60deg 75deg 5.8m",
    cameraTarget: "-0.06m 0.24m 0m",
    fieldOfView: "35deg",
    translateY: "27px",
  },
  {
    id: "007",
    name: "Squirtle",
    src: "https://raw.githubusercontent.com/06wj/pokemon/master/public/models/007/model.glb",
    cameraOrbit: "-60deg 75deg 4.3m",
    cameraTarget: "0m 0.22m 0m",
    fieldOfView: "35deg",
    translateY: "10px",
  },
  {
    id: "001",
    name: "Bulbasaur",
    src: "https://raw.githubusercontent.com/06wj/pokemon/master/public/models/001/model.glb",
    cameraOrbit: "-60deg 75deg 2.9m",
    cameraTarget: "0m 0.20m 0m",
    fieldOfView: "35deg",
    translateY: "30px",
  },
] as const;

export function PokemonRunner() {
  const runnerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = runnerRef.current;
    if (!el) return;

    const onIteration = () => {
      setActiveIndex((prev) => (prev + 1) % RUNNER_MODELS.length);
    };

    el.addEventListener("animationiteration", onIteration);
    return () => el.removeEventListener("animationiteration", onIteration);
  }, []);

  return (
    <>
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
        strategy="afterInteractive"
      />
      <div className={styles.runnerTrackWrapper}>
        <div
          ref={runnerRef}
          className={styles.filterbar3dRunner}
          title="⚡ 3D Pokémon companions running across the shelf"
          aria-hidden="true"
        >
          <div className={styles.runnerStage}>
            {RUNNER_MODELS.map((model, idx) => (
              <model-viewer
                key={model.id}
                id={`runner-${model.id}`}
                class={`${styles.runnerModel} ${idx === activeIndex ? styles.runnerModelActive : ""}`}
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
            ))}
            <div className={styles.runnerContactShadow} />
          </div>
        </div>
      </div>
    </>
  );
}
