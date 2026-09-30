import React from "react";
import { markup } from "../pages/markup/footer";
export function Footer() {
  return <div id="footer" className="legacy-partial footer-partial" dangerouslySetInnerHTML={{__html: markup}} />;
}
