import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import TableFormatter from "./App.tsx";
import { Toaster } from "@/components/ui/sonner";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TableFormatter />
    <Toaster />
  </StrictMode>,
);
