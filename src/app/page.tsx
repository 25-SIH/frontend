"use client";
import styles from "./page.module.css";
import Prism from "@/components/ui/prism";
import { MdRocketLaunch } from "react-icons/md";
import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", height: "100vh", position: "relative" }}>
        <Prism
          animationType="hover"
          timeScale={0.5}
          height={3.5}
          baseWidth={5.5}
          scale={1.6}
          hueShift={0}
          colorFrequency={1}
          noise={0.5}
          glow={1}
        />
      </div>
      <div className={styles.heroTextContainer}>
        <h1>
          AI THAT KNOWS YOUR DOCUMENTS
          <br /> BETTER THAN YOU
        </h1>
        <Link href="/chat" className={styles.launchButton}>
          Launch
          <MdRocketLaunch
            size={48}
            style={{ verticalAlign: "middle", marginLeft: "0.25rem" }}
          />
        </Link>
      </div>
    </main>
  );
}
