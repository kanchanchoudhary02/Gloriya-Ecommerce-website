import React, { useEffect, useRef } from "react";
import "./migration.css";
import { createRoot } from "react-dom/client";

import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { Notifier } from "./components/Notifier";
import pages from "./pages/pages";

/**
 * =========================================================
 * GLOBAL API BASE
 * =========================================================
 *
 * Select the backend from the current environment so stale globals or
 * production build variables cannot route API requests to the storefront.
 */
const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "https://gloriya-ecommerce-website.onrender.com/api";

window.API_BASE = API_BASE;

/**
 * =========================================================
 * LOAD LEGACY SCRIPT
 * =========================================================
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Avoid loading the same legacy script multiple times.
    const existing = document.querySelector(
      `script[data-legacy-src="${src}"]`
    );

    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");

    script.src = src;
    script.async = false;
    script.dataset.legacySrc = src;

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      reject(new Error(`Failed to load legacy script: ${src}`));
    };

    document.head.appendChild(script);
  });
}

/**
 * =========================================================
 * RUN PAGE SCRIPTS
 * =========================================================
 */
async function runPageScripts(scripts = []) {
  for (const src of scripts) {
    if (!src) continue;

    try {
      await loadScript(src);
    } catch (error) {
      console.error(`Could not load script: ${src}`, error);
    }
  }
}

/**
 * =========================================================
 * CONTACT FORM NORMALIZATION
 * =========================================================
 *
 * This does NOT replace the actual contact validation.
 * It simply makes sure that accidental spaces around an
 * email address do not cause a valid email to fail.
 */
function normalizeContactEmail() {
  const emailInput = document.getElementById("email");

  if (!emailInput) return;

  // Make sure the field is treated as an email field.
  emailInput.type = "email";

  const cleanEmail = (emailInput.value || "").trim();

  if (emailInput.value !== cleanEmail) {
    emailInput.value = cleanEmail;
  }
}

/**
 * =========================================================
 * CONTACT FORM SETUP
 * =========================================================
 */
function setupContactForm() {
  const form = document.getElementById("contactForm");

  if (!form) return () => {};

  const emailInput = document.getElementById("email");

  /**
   * Remove accidental spaces while typing/pasting.
   */
  const handleEmailInput = () => {
    if (!emailInput) return;

    emailInput.value = emailInput.value.replace(/\s+/g, "");
    emailInput.setCustomValidity("");
  };

  /**
   * Normalize before validation.
   */
  const handleEmailBlur = () => {
    normalizeContactEmail();
    if (emailInput && emailInput.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)) {
      emailInput.setCustomValidity("Please enter a valid email.");
    } else if (emailInput) {
      emailInput.setCustomValidity("");
    }
  };

  if (emailInput) {
    emailInput.addEventListener("input", handleEmailInput);
    emailInput.addEventListener("blur", handleEmailBlur);
  }

  /**
   * Normalize email before the existing legacy submit
   * handlers execute.
   *
   * We intentionally DO NOT stop propagation here because
   * the existing contact/Resend functionality must continue
   * working.
   */
  const handleSubmitCapture = () => {
    normalizeContactEmail();
  };

  form.addEventListener("submit", handleSubmitCapture, true);

  /**
   * Cleanup.
   */
  return () => {
    if (emailInput) {
      emailInput.removeEventListener("input", handleEmailInput);
      emailInput.removeEventListener("blur", handleEmailBlur);
    }

    form.removeEventListener("submit", handleSubmitCapture, true);
  };
}

/**
 * =========================================================
 * LEGACY PAGE
 * =========================================================
 */
function LegacyPage({ page }) {
  const rootRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let cleanupContactForm = null;

    async function initializePage() {
      try {
        /**
         * Common scripts required by every page.
         */
        const commonScripts = [
          "/legacy/navbar.js",
          "/legacy/notifier.js",
          "/legacy/footer.js",
        ];

        /**
         * Page-specific scripts.
         */
        const pageScripts = Array.isArray(page?.scripts)
          ? page.scripts
          : [];

        /**
         * Load all legacy scripts sequentially.
         */
        await runPageScripts([
          ...commonScripts,
          ...pageScripts,
        ]);

        if (cancelled) return;

        /**
         * Contact page specific setup.
         */
        if (page?.name === "contact") {
          cleanupContactForm = setupContactForm();
        }

        /**
         * -----------------------------------------------------
         * LEGACY DOMContentLoaded COMPATIBILITY
         * -----------------------------------------------------
         *
         * The old application used DOMContentLoaded listeners.
         * React mounts after the browser's original
         * DOMContentLoaded event, so dispatch it once after
         * the legacy scripts and markup are ready.
         */
        document.dispatchEvent(
          new Event("DOMContentLoaded", {
            bubbles: true,
          })
        );
      } catch (error) {
        console.error(
          "Legacy page initialization failed:",
          error
        );
      }
    }

    initializePage();

    /**
     * Cleanup on page/component unmount.
     */
    return () => {
      cancelled = true;

      if (typeof cleanupContactForm === "function") {
        cleanupContactForm();
      }
    };
  }, [page]);

  return (
    <div
      ref={rootRef}
      data-react-migrated-page={page?.name || "unknown"}
    >
      <Navbar />

      {page?.hasNotifier && <Notifier />}

      <div
        className="page-content"
        dangerouslySetInnerHTML={{
          __html: page?.markup || "",
        }}
      />

      <Footer />
    </div>
  );
}

/**
 * =========================================================
 * CURRENT PAGE
 * =========================================================
 */
const pageName =
  document.documentElement.dataset.page ||
  document.body.dataset.page ||
  "index";

/**
 * Fallback to index if an unknown page is requested.
 */
const Page = pages[pageName] || pages.index;

/**
 * =========================================================
 * REACT MOUNT
 * =========================================================
 */
const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error(
    'Gloriya Jewellery: <div id="root"></div> was not found.'
  );
} else {
  createRoot(rootElement).render(
    <LegacyPage page={Page} />
  );
}