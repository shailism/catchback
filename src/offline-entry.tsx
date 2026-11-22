// A client-rendered fallback, not an SSR document masquerading as hydration data.
import { createRoot } from "react-dom/client";
import { HeadContent, RouterProvider, createBrowserHistory } from "@tanstack/react-router";
import { getRouter } from "./router";
import { Route } from "./routes/__root";
import type { ReactNode } from "react";

const router = getRouter();
router.update({ ...router.options, history: createBrowserHistory(), isServer: false });
Object.assign(Route.options, { shellComponent: ({ children }: { children: ReactNode }) => <html lang="en"><head><HeadContent /></head><body>{children}</body></html> });
createRoot(document).render(<RouterProvider router={router} />);