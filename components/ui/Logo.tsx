"use client";

import Link from "next/link";
import Image from "next/image";
import symbolLogo from "@/Group 32.png";
import fullLogo from "@/Healthspan Logo.png";
import styles from "./Logo.module.css";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "xxl" | "xxxl" | "xxxxl";
  showText?: boolean;
  fillWidth?: boolean;
}

export default function Logo({
  size = "md",
  showText = true,
  fillWidth = false,
}: LogoProps) {
  const fullLogoWidths = {
    sm: 104,
    md: 138,
    lg: 205,
    xl: 270,
    xxl: 340,
    xxxl: 460,
    xxxxl: 442,
  } as const;

  const symbolWidths = {
    sm: 34,
    md: 44,
    lg: 58,
    xl: 76,
    xxl: 94,
    xxxl: 118,
    xxxxl: 114,
  } as const;

  const selectedImage = showText ? fullLogo : symbolLogo;
  const targetWidth = showText ? fullLogoWidths[size] : symbolWidths[size];
  const targetHeight = Math.round(
    (targetWidth * selectedImage.height) / selectedImage.width
  );

  return (
    <Link
      href="/"
      className={`${styles.logo} ${fillWidth ? styles.logoFill : ""}`.trim()}
    >
      <Image
        src={selectedImage}
        alt={showText ? "Healthspan" : "Healthspan symbol"}
        className={`${styles.image} ${styles[`image${size.toUpperCase()}`]} ${
          fillWidth ? styles.fillWidth : ""
        }`}
        width={targetWidth}
        height={targetHeight}
        priority={size !== "sm"}
      />
    </Link>
  );
}
