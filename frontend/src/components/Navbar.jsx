import React from "react";
import { markup, script } from "../pages/markup/navbar";
export function Navbar() {
  return <div id="navbar" className="legacy-partial navbar-partial" dangerouslySetInnerHTML={{__html: markup}} data-partial-script={script ? "navbar" : undefined} />;
}
