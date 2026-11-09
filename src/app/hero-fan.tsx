"use client";

import { useRef } from "react";
import styles from "./catalog.module.css";

export function HeroFan() {
  const stageRef = useRef<HTMLDivElement>(null);
  const tiltTicking = useRef(false);

  function handleStageTilt(e: React.MouseEvent<HTMLDivElement>) {
    if (tiltTicking.current) return;
    tiltTicking.current = true;
    requestAnimationFrame(() => {
      const wrapper = stageRef.current;
      if (!wrapper) {
        tiltTicking.current = false;
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      wrapper.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 9}deg)`;
      tiltTicking.current = false;
    });
  }

  function resetStageTilt() {
    const wrapper = stageRef.current;
    if (wrapper) {
      wrapper.style.transition = "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
      wrapper.style.transform = "rotateY(0deg) rotateX(0deg)";
      setTimeout(() => {
        if (wrapper) wrapper.style.transition = "transform 0.15s ease-out";
      }, 600);
    }
  }

  function scrollToCatalog() {
    const el = document.getElementById("catalog-anchor");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <section className={styles.heroSplitSection}>
      {/* Animated Hero Background Graphics & Depth Layer */}
      <div className={styles.heroBgGraphics} aria-hidden="true">
        {/* 1. Technical Curator Matrix Grid */}
        <div className={styles.heroGridMatrix} />

        {/* 2. Ambient Fluid Color Blobs */}
        <div className={`${styles.heroBlob} ${styles.heroBlobCyan}`} />
        <div className={`${styles.heroBlob} ${styles.heroBlobOrange}`} />

        {/* 3. Celestial Orbital Compass Ring */}
        <svg className={styles.heroCelestialOrbit} viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="300" cy="300" r="260" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" opacity="0.3" />
          <circle cx="300" cy="300" r="190" stroke="currentColor" strokeWidth="1.2" strokeDasharray="180 30 90 20" opacity="0.4" />
          <line x1="80" y1="80" x2="520" y2="520" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 6" opacity="0.2" />
          <path d="M 300 30 L 300 50 M 300 550 L 300 570 M 30 300 L 50 300 M 550 300 L 570 300" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
          <circle cx="300" cy="40" r="4.5" fill="var(--brand-cyan)" />
          <circle cx="490" cy="300" r="4" fill="var(--brand-orange)" />
          <circle cx="110" cy="300" r="3.5" fill="var(--brand-cyan)" />
        </svg>

        {/* 4. Translucent Wireframe Surround Silhouette */}
        <svg className={styles.heroWireframeFrame} viewBox="0 0 240 340" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="236" height="336" rx="14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.35" />
          <rect x="24" y="24" width="192" height="268" rx="8" stroke="currentColor" strokeWidth="1" opacity="0.25" />
          <path d="M 12 12 L 20 12 M 12 12 L 12 20" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
          <path d="M 228 12 L 220 12 M 228 12 L 228 20" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
          <path d="M 12 328 L 20 328 M 12 328 L 12 320" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
          <path d="M 228 328 L 220 328 M 228 328 L 228 320" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
          <text x="30" y="316" fontFamily="monospace" fontSize="9" fill="currentColor" opacity="0.5">EXTENDED ART · 0.1MM FIT</text>
        </svg>

        {/* 5. Holographic SAR Foil Sparkle Stars */}
        <svg className={`${styles.heroSparkle} ${styles.sparkle1}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M 12 0 Q 12 12 0 12 Q 12 12 12 24 Q 12 12 24 12 Q 12 12 12 0 Z" />
        </svg>
        <svg className={`${styles.heroSparkle} ${styles.sparkle2}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M 12 0 Q 12 12 0 12 Q 12 12 12 24 Q 12 12 24 12 Q 12 12 12 0 Z" />
        </svg>
        <svg className={`${styles.heroSparkle} ${styles.sparkle3}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M 12 0 Q 12 12 0 12 Q 12 12 12 24 Q 12 12 24 12 Q 12 12 12 0 Z" />
        </svg>
        <svg className={`${styles.heroSparkle} ${styles.sparkle4}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M 12 0 Q 12 12 0 12 Q 12 12 12 24 Q 12 12 24 12 Q 12 12 12 0 Z" />
        </svg>
      </div>

      {/* Hero Headline & Copy */}
      <div className={styles.heroTextBlock}>
        <span className={styles.heroBadgePill}>✨ The Pullpage Collection</span>
        <h1 className={styles.heroHeadline}>
          Art that completes <br /><span className={styles.cyanSpark}>the page.</span>
        </h1>
        <p className={styles.heroDesc}>
          Discover extended-art surrounds designed to turn a favorite Pokémon card into a full-page moment. Measured to 0.1mm tolerance for Binder Sleeves and Toploaders.
        </p>
        <div className={styles.heroCtaRow}>
          <button type="button" className={styles.btnHeroPrimary} onClick={scrollToCatalog}>
            Explore Extended Arts ↓
          </button>
        </div>
      </div>

      {/* 3D Perspective Stage: Expanding Fan */}
      <div className={styles.perspectiveStage}>
        <div
          ref={stageRef}
          className={styles.stageTiltWrapper}
          onMouseMove={handleStageTilt}
          onMouseLeave={resetStageTilt}
        >
          <div className={styles.trio3dStage}>
            {/* Slot 1: Left (Pikachu AR) */}
            <div className={`${styles.cardSlot} ${styles.slotLeft}`} onClick={scrollToCatalog} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") scrollToCatalog(); }}>
              <div className={`${styles.card3d} ${styles.cardFloat1}`}>
                <div className={styles.cardSheen} />
                <img
                  src="https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=600&auto=format&fit=crop&q=80"
                  alt="Pikachu Extended Art"
                  className={styles.card3dImg}
                />
                <div className={styles.cardMetaScrim}>
                  <span className={styles.metaRarity}>AR · 151 #173</span>
                  <h4>Pikachu</h4>
                  <p>&ldquo;Electric Bloom&rdquo; · Rp 95k</p>
                </div>
              </div>
            </div>

            {/* Slot 2: Center (Charizard ex SAR) */}
            <div className={`${styles.cardSlot} ${styles.slotCenter}`} onClick={scrollToCatalog} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") scrollToCatalog(); }}>
              <div className={`${styles.card3d} ${styles.cardFloat2}`}>
                <div className={styles.cardSheen} />
                <img
                  src="https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80"
                  alt="Charizard ex Extended Art"
                  className={styles.card3dImg}
                />
                <div className={styles.cardMetaScrim}>
                  <span className={styles.metaRarity} style={{ color: "#f59e0b" }}>SAR · 151 #199</span>
                  <h4>Charizard ex</h4>
                  <p>&ldquo;Starlight Surge&rdquo; Edition · From Rp 50k</p>
                </div>
              </div>
            </div>

            {/* Slot 3: Right (Blastoise ex SAR) */}
            <div className={`${styles.cardSlot} ${styles.slotRight}`} onClick={scrollToCatalog} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") scrollToCatalog(); }}>
              <div className={`${styles.card3d} ${styles.cardFloat3}`}>
                <div className={styles.cardSheen} />
                <img
                  src="https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80"
                  alt="Blastoise ex Extended Art"
                  className={styles.card3dImg}
                />
                <div className={styles.cardMetaScrim}>
                  <span className={styles.metaRarity} style={{ color: "#0ea5e9" }}>SAR · 151 #200</span>
                  <h4>Blastoise ex</h4>
                  <p>&ldquo;Hydro Cascade&rdquo; · From Rp 50k</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
