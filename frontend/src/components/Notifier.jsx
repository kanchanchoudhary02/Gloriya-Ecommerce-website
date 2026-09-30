import React from "react";
import { markup } from "../pages/markup/notifier";
export function Notifier() {
  return <div id="notifier" className="legacy-partial notifier-partial" dangerouslySetInnerHTML={{__html: markup}} />;
}
